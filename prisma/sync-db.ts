/**
 * GoCab CRM — Universal Database Auto-Sync & Migration Script
 * 
 * Executes SQLite / LibSQL schema DDL from schema.sql against
 * both local SQLite and remote Turso databases, then seeds team accounts.
 * 
 * Run: npx tsx prisma/sync-db.ts
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Require prisma AFTER dotenv has run to prevent missing env var error
const { prisma } = require("../src/lib/prisma");

async function syncSchema() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log("⚡ GoCab CRM — Connecting to DB:", url.startsWith("libsql://") ? "Turso Cloud" : "Local SQLite");

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  const schemaPath = path.join(process.cwd(), "prisma", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const rawSql = fs.readFileSync(schemaPath, "utf-8");
    const statements = rawSql
      .split(";\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err: any) {
        // Table or index already exists is normal
        if (!err.message.includes("already exists")) {
          console.warn("Schema execute warning:", err.message);
        }
      }
    }

    // Safe Alter Table Column Migrations for SQLite / Turso
    const migrations = [
      "ALTER TABLE DriverProfile ADD COLUMN consecutiveUnpaidDays INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE DriverProfile ADD COLUMN lastPaymentDate DATETIME",
      "ALTER TABLE DriverProfile ADD COLUMN lastDailyChargeDate DATETIME",
      "ALTER TABLE PaymentLedger ADD COLUMN paymentDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE PaymentLedger ADD COLUMN arrearsMAD REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE PaymentLedger ADD COLUMN morningBalance REAL",
      "ALTER TABLE PaymentLedger ADD COLUMN eveningBalance REAL",
      "ALTER TABLE PaymentLedger ADD COLUMN calculatedDelta REAL",
      "ALTER TABLE PaymentLedger ADD COLUMN notes TEXT",
      "ALTER TABLE Lead ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE Lead ADD COLUMN notes TEXT",
      "ALTER TABLE Vehicle ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE MaintenanceTicket ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE DriverProfile ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE VehicleExpense ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0",
    ];

    for (const migration of migrations) {
      try {
        await client.execute(migration);
      } catch (err: any) {
        // Column duplicate is expected if already added
      }
    }

    console.log(`✅ Schema synced (${statements.length} DDL statements verified).`);
  }

  // Seed default Ops Manager
  const email = "mouad.koudia@gocab.io";
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword) {
    console.warn("⚠️  SEED_ADMIN_PASSWORD not set in env — skipping admin account seed.");
    await prisma.$disconnect();
    return;
  }
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          name: "Mouad Koudia",
          fullName: "Mouad Koudia",
          passwordHash,
          role: "OPS_MANAGER",
          region: "CASABLANCA",
          isActive: true,
          mustChangePassword: false,
        },
      });
      console.log(`✨ Ops Manager account created: ${email}`);
    } else {
      await prisma.user.update({
        where: { email },
        data: { passwordHash, role: "OPS_MANAGER", isActive: true },
      });
      console.log(`✅ Ops Manager account updated: ${email}`);
    }
  } catch (err: any) {
    console.error("User seed error:", err.message);
  }

  await prisma.$disconnect();
}

syncSchema().catch((e) => {
  console.error("❌ Sync failed:", e);
  process.exit(1);
});
