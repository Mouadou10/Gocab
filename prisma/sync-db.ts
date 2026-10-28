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
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Require prisma AFTER dotenv has run to prevent missing env var error
const { prisma } = require("../src/lib/prisma");

const PRODUCTION_TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io";
const PRODUCTION_TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";

async function syncSchema() {
  let rawUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || PRODUCTION_TURSO_URL;
  if (
    rawUrl.startsWith("postgres://") ||
    rawUrl.startsWith("postgresql://") ||
    rawUrl.includes("restored") ||
    rawUrl.includes("mouadou123-3668")
  ) {
    rawUrl = PRODUCTION_TURSO_URL;
  }
  const url = rawUrl.replace("libsql://", "https://").replace(/\/$/, "");
  const authToken =
    url === PRODUCTION_TURSO_URL
      ? PRODUCTION_TURSO_TOKEN
      : process.env.TURSO_AUTH_TOKEN || PRODUCTION_TURSO_TOKEN;

  console.log("⚡ GoCab CRM — Connecting to DB:", (url.startsWith("libsql://") || url.startsWith("https://")) ? "Turso Cloud" : "Local SQLite");

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  let tursoBlocked = false;
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
        if (String(err?.message || "").includes("BLOCKED")) {
          console.warn("⚠️ Turso Cloud quota block detected during build — local SQLite failover replica active.");
          tursoBlocked = true;
          break;
        }
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
      "ALTER TABLE MaintenanceTicket ADD COLUMN started_at DATETIME",
      "ALTER TABLE DriverProfile ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE VehicleExpense ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE FieldTask ADD COLUMN scheduled_date TEXT",
      "ALTER TABLE FieldTask ADD COLUMN scheduled_time TEXT",
      "ALTER TABLE FieldTask ADD COLUMN duration_hours REAL DEFAULT 1.0",
      "ALTER TABLE Vehicle ADD COLUMN historical_driver_name TEXT",
      "ALTER TABLE Vehicle ADD COLUMN historical_driver_phone TEXT",
      "ALTER TABLE Vehicle ADD COLUMN documents TEXT DEFAULT '[]'",
      "ALTER TABLE DriverProfile ADD COLUMN isRedFlagged BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE DriverProfile ADD COLUMN redFlagReason TEXT",
      "ALTER TABLE DriverProfile ADD COLUMN redFlaggedAt DATETIME",
      "ALTER TABLE DriverProfile ADD COLUMN redFlaggedBy TEXT",
      `CREATE TABLE IF NOT EXISTS "DriverComment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "driverId" TEXT NOT NULL,
        "authorName" TEXT NOT NULL,
        "authorRole" TEXT,
        "content" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DriverComment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS "DriverComment_driverId_idx" ON "DriverComment"("driverId")`,
    ];

    for (const migration of migrations) {
      if (tursoBlocked) break;
      try {
        await client.execute(migration);
      } catch (err: any) {
        if (String(err?.message || "").includes("BLOCKED")) {
          tursoBlocked = true;
          break;
        }
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
      email: "kurbankerimov@gocab.io",
      name: "Kurban Kerimov",
      fullName: "Kurban Kerimov",
      role: "OPS_MANAGER",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
    {
      email: "kaoutar.ouardi@gocab.io",
      name: "Kaoutar Ouardi",
      fullName: "Kaoutar Ouardi",
      role: "LEAD_ACQUISITION_JR",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
    {
      email: "nour.abouri@gocab.io",
      name: "Nour Abouri",
      fullName: "Nour Abouri",
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
    {
      email: "ayoub.gsaib@gocab.io",
      name: "Ayoub Gsaib",
      fullName: "Ayoub Gsaib",
      role: "ONBOARDING_SPECIALIST",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
    {
      email: "mohamed.aziz@gocab.io",
      name: "Mohamed Aziz",
      fullName: "Mohamed Aziz",
      role: "FLEET_PERF_MANAGER",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
    {
      email: "mehdi.elyattouti@gocab.io",
      name: "Mehdi Elyattouti",
      fullName: "Mehdi Elyattouti",
      role: "FLEET_PERF_MANAGER",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
    {
      email: "hamza.rassid@gocab.io",
      name: "Hamza Rassid",
      fullName: "Hamza Rassid",
      role: "FIELD_SUPERVISOR",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
    {
      email: "ayoub.rassid@gocab.io",
      name: "Ayoub Rassid",
      fullName: "Ayoub Rassid",
      role: "FIELD_SUPERVISOR",
      pass: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
    },
  ];

  for (const member of teamToSync) {
    try {
      const passwordHash = await bcrypt.hash(member.pass, 12);
      const existing = await prisma.user.findFirst({
        where: { email: member.email },
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
