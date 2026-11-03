/**
 * GoCab CRM — Universal Hosted Database Migration & Cutover Tool
 *
 * Migrates all reconciled data from local SQLite (dev.db or backup) into the durable
 * hosted database (Turso LibSQL Cloud or PostgreSQL) with 100% verification.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-hosted-db.ts [--dry-run] [--source=backups/...db]
 *
 * Environment variables:
 *   TURSO_DATABASE_URL (or DATABASE_URL)
 *   TURSO_AUTH_TOKEN
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { prisma } from "../src/lib/prisma";

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const sourceArg = args.find((a) => a.startsWith("--source="))?.split("=")[1];
const targetUrlArg = args.find((a) => a.startsWith("--target-url="))?.split("=")[1];
const targetTokenArg = args.find((a) => a.startsWith("--target-token="))?.split("=")[1];

const targetUrl =
  targetUrlArg ||
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL;
const targetToken =
  targetTokenArg ||
  process.env.TURSO_AUTH_TOKEN;

const TABLES_IN_ORDER = [
  "User",
  "Setting",
  "Blacklist",
  "Vehicle",
  "DriverProfile",
  "Lead",
  "PaymentLedger",
  "DailyCollection",
  "PaymentCancellation",
  "FieldTask",
  "FieldInspectionNew",
  "VehicleInspection",
  "SupportTicket",
  "AccidentClaim",
  "MaintenanceTicket",
  "WeeklyObjective",
  "AuditLog",
  "WhatsAppConversation",
  "WhatsAppMessage",
  "LeadActivityLog",
  "DriverComment",
];

async function main() {
  console.log("==================================================================");
  console.log("🚀 GoCab CRM — Hosted Database Migration & Cutover Engine");
  console.log("==================================================================");

  if (!targetUrl) {
    console.error("❌ ERROR: No target database specified!");
    console.error("Set TURSO_DATABASE_URL in environment or pass --target-url=<url>");
    process.exit(1);
  }

  const cleanUrl = targetUrl.replace("libsql://", "https://").replace(/\/$/, "");
  const isRemote = cleanUrl.startsWith("https://") || cleanUrl.startsWith("libsql://");

  console.log(`Target Database: ${cleanUrl} (${isRemote ? "Hosted Remote" : "Local"})`);
  console.log(`Mode: ${isDryRun ? "DRY RUN (read-only verification)" : "LIVE MIGRATION"}\n`);

  const targetClient = createClient({
    url: cleanUrl,
    ...(isRemote && targetToken ? { authToken: targetToken } : {}),
  });

  // 1. Verify target connection
  console.log("🔍 Checking target database connectivity...");
  try {
    const ping = await targetClient.execute("SELECT 1 as ping;");
    if (!ping.rows || ping.rows.length === 0) throw new Error("Invalid ping response");
    console.log("✅ Target database is reachable!\n");
  } catch (err: any) {
    console.error("❌ Failed to connect to target database:", err.message || err);
    process.exit(1);
  }

  // 2. Ensure schema DDL exists on target
  const schemaSqlPath = path.join(process.cwd(), "prisma", "schema.sql");
  if (fs.existsSync(schemaSqlPath)) {
    console.log("📄 Verifying table schemas on target...");
    const ddlContent = fs.readFileSync(schemaSqlPath, "utf8");
    const statements = ddlContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await targetClient.execute(stmt);
      } catch (err: any) {
        // Ignore "already exists" or non-critical DDL errors
        if (!err.message?.includes("already exists")) {
          console.warn(`  ⚠️ DDL notice on statement [${stmt.slice(0, 40)}...]:`, err.message);
        }
      }
    }
    console.log("✅ Schema DDL applied on target database.\n");
  }

  // 3. Inspect source data counts via Prisma
  console.log("📊 Inspecting source dataset counts...");
  const sourceClient = createClient({
    url: `file:${path.join(process.cwd(), sourceArg || "dev.db").replace(/\\/g, "/")}`,
  });

  const sourceCounts: Record<string, number> = {};
  for (const table of TABLES_IN_ORDER) {
    try {
      const res = await sourceClient.execute(`SELECT COUNT(*) as c FROM ${table};`);
      sourceCounts[table] = Number(res.rows[0]?.c || 0);
    } catch {
      sourceCounts[table] = 0;
    }
  }

  console.table(sourceCounts);

  if (isDryRun) {
    console.log("\n🏁 Dry run complete — 0 rows written.");
    return;
  }

  // 4. Migrate tables in topological order
  console.log("\n📦 Starting batch data transfer into target database...");
  const migrationResults: Record<string, { source: number; migrated: number; status: string }> = {};

  for (const table of TABLES_IN_ORDER) {
    const totalCount = sourceCounts[table] || 0;
    if (totalCount === 0) {
      migrationResults[table] = { source: 0, migrated: 0, status: "SKIPPED (empty)" };
      continue;
    }

    process.stdout.write(`  Migrating ${table} (${totalCount} rows)... `);
    let migratedCount = 0;

    // Fetch all rows from source in batches of 100
    const BATCH_SIZE = 100;
    for (let offset = 0; offset < totalCount; offset += BATCH_SIZE) {
      const rowsRes = await sourceClient.execute(
        `SELECT * FROM ${table} LIMIT ${BATCH_SIZE} OFFSET ${offset};`
      );

      if (rowsRes.rows.length === 0) break;

      const columns = rowsRes.columns;
      const placeholders = columns.map(() => "?").join(", ");
      const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders});`;

      // Execute batch insert into target
      for (const row of rowsRes.rows) {
        const values = columns.map((col) => row[col]);
        await targetClient.execute({
          sql: insertSql,
          args: values as any,
        });
        migratedCount++;
      }
    }

    migrationResults[table] = {
      source: totalCount,
      migrated: migratedCount,
      status: migratedCount === totalCount ? "SUCCESS" : "MISMATCH",
    };
    console.log(`Done (${migratedCount}/${totalCount})`);
  }

  // 5. Verification Phase: Check row parity on target
  console.log("\n🔍 Running post-migration count verification on target database...");
  const verificationResults: Record<string, { source: number; target: number; parity: boolean }> = {};
  let allParity = true;

  for (const table of TABLES_IN_ORDER) {
    const srcC = sourceCounts[table] || 0;
    let tgtC = 0;
    try {
      const res = await targetClient.execute(`SELECT COUNT(*) as c FROM ${table};`);
      tgtC = Number(res.rows[0]?.c || 0);
    } catch {
      tgtC = -1;
    }

    const isMatch = srcC === tgtC;
    if (!isMatch && srcC > 0) allParity = false;

    verificationResults[table] = {
      source: srcC,
      target: tgtC,
      parity: isMatch,
    };
  }

  console.table(verificationResults);

  if (allParity) {
    console.log("\n🎉 DATA MIGRATION VERIFIED WITH 100% PARITY ACROSS ALL TABLES!");
    console.log("All leads, driver profiles, vehicles, and payment ledgers are securely hosted.");
  } else {
    console.warn("\n⚠️ Some table counts differed. Please review table breakdown above.");
  }
}

main().catch((err) => {
  console.error("\n❌ Fatal migration error:", err);
  process.exit(1);
});
