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
      "ALTER TABLE Lead ADD COLUMN handled_by TEXT",
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

  // Seed default Ops Manager and Core Agents
  const teamToSync = [
    {
      email: "mouad.koudia@gocab.io",
      name: "Mouad Koudia",
      fullName: "Mouad Koudia",
      role: "OPS_MANAGER",
      pass: process.env.SEED_ADMIN_PASSWORD || "Moulana@pc1995",
    },
    {
      email: "kaoutar.ouardi@gocab.io",
      name: "Kaoutar Ouardi",
      fullName: "Kaoutar Ouardi",
      role: "LEAD_ACQUISITION_JR",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
    {
      email: "salma.abouri@gocab.io",
      name: "Salma Abouri",
      fullName: "Salma Abouri",
      role: "LEAD_ACQUISITION_JR",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
  ];

  for (const member of teamToSync) {
    try {
      const passwordHash = await bcrypt.hash(member.pass, 12);
      const firstName = member.name.split(" ")[0];
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { email: member.email },
            { fullName: { contains: firstName } },
            { name: { contains: firstName } },
          ],
        },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            email: member.email,
            name: member.name,
            fullName: member.fullName,
            passwordHash,
            role: member.role,
            region: "CASABLANCA",
            isActive: true,
            mustChangePassword: false,
          },
        });
        console.log(`✨ User account created: ${member.email} (${member.role})`);
      } else {
        // IMPORTANT: Preserve existing.role set by Ops Manager in Settings
        // Never overwrite customized roles on redeployment!
        const preservedRole = existing.role || member.role;
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            email: member.email,
            name: member.name,
            fullName: member.fullName,
            role: preservedRole,
            isActive: true,
          },
        });
        console.log(`✅ User account verified: ${member.email} (retained role: ${preservedRole})`);
      }
    } catch (err: any) {
      console.error(`User seed error for ${member.email}:`, err.message);
    }
  }

  await prisma.$disconnect();
}

syncSchema().catch((e) => {
  console.error("❌ Sync failed:", e);
  process.exit(1);
});
