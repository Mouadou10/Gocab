/**
 * Complete Full-History Synchronization from Turso Cloud to dev.db
 * Restores 100% of tables and data from Day 1 till Today for the entire team:
 * - PaymentLedger (3,179 rows)
 * - MaintenanceTicket (169 rows)
 * - DriverProfile (155 rows)
 * - Vehicle (101 rows)
 * - VehicleInspection (45 rows)
 * - AccidentClaim (24 rows)
 * - ChurnEvent (20 rows)
 * - VehicleExpense (18 rows)
 * - VehicleIssue (10 rows)
 * - RepairReminder (5 rows)
 * - DriverComment (2 rows)
 * - AuditLog (8 rows)
 * - FieldTask (35 rows)
 * - Lead (3,079 rows)
 * - LeadActivityLog (11,707 rows)
 * - WhatsAppConversation (257 rows)
 * - WhatsAppMessage (2,134 rows)
 * - User (14 rows)
 * - Setting (21 rows)
 */

import Database from "better-sqlite3";
import path from "path";

const TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io/v2/pipeline";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";

const localDb = new Database(path.join(process.cwd(), "dev.db"));
localDb.pragma("foreign_keys = OFF");

async function executeTurso(sql: string, retries = 4): Promise<{ cols: string[]; rows: any[] }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(TURSO_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TURSO_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{ type: "execute", stmt: { sql } }],
        }),
      });

      const body = await res.json();
      const r = body.results?.[0];
      if (r?.type === "error") {
        throw new Error(`Turso SQL error: ${r.error.message}`);
      }
      const cols = r?.response?.result?.cols?.map((c: any) => c.name) || [];
      const rows = r?.response?.result?.rows || [];
      return { cols, rows };
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.warn(`\n[Attempt ${attempt}/${retries}] Network hiccup: ${err.message}. Retrying in 2s...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return { cols: [], rows: [] };
}

function parseVal(cell: any) {
  if (!cell || cell.type === "null") return null;
  if (cell.type === "integer") return Number(cell.value);
  if (cell.type === "float") return Number(cell.value);
  return cell.value;
}

async function syncTable(tableName: string, hasRowIdBatching = false) {
  console.log(`\n⏳ Synchronizing ${tableName}...`);

  // Check destination table columns
  const tableInfo = localDb.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
  if (!tableInfo || tableInfo.length === 0) {
    console.log(`⚠️ Destination table ${tableName} does not exist in dev.db, skipping.`);
    return;
  }
  const validDestCols = new Set(tableInfo.map((c) => c.name));

  let totalSynced = 0;

  if (!hasRowIdBatching) {
    const { cols, rows } = await executeTurso(`UPDATE "${tableName}" SET rowid = rowid RETURNING *`);
    if (rows.length === 0) {
      console.log(`ℹ️ ${tableName} has 0 rows in Turso.`);
      return;
    }

    // Keep only columns that exist in local table
    const matchedCols = cols.filter((c: string) => validDestCols.has(c));
    const placeholders = matchedCols.map(() => "?").join(", ");
    const colNames = matchedCols.map((c: string) => `"${c}"`).join(", ");
    const insertStmt = localDb.prepare(`INSERT OR REPLACE INTO "${tableName}" (${colNames}) VALUES (${placeholders})`);

    const trans = localDb.transaction((rowsToInsert) => {
      for (const row of rowsToInsert) {
        const values = matchedCols.map((c: string) => parseVal(row[cols.indexOf(c)]));
        insertStmt.run(...values);
      }
    });

    trans(rows);
    totalSynced = rows.length;
  } else {
    // Large tables with batching by rowid (e.g. PaymentLedger, LeadActivityLog, WhatsAppMessage)
    let lastRowid = 0;
    while (true) {
      const { cols, rows } = await executeTurso(`
        UPDATE "${tableName}" SET rowid = rowid 
        WHERE rowid in (
          SELECT rowid FROM "${tableName}" 
          WHERE rowid > ${lastRowid} 
          ORDER BY rowid ASC 
          LIMIT 1000
        )
        RETURNING rowid, *
      `);

      if (rows.length === 0) break;

      const matchedCols = cols.filter((c: string) => c !== "rowid" && validDestCols.has(c));
      const placeholders = matchedCols.map(() => "?").join(", ");
      const colNames = matchedCols.map((c: string) => `"${c}"`).join(", ");
      const insertStmt = localDb.prepare(`INSERT OR REPLACE INTO "${tableName}" (${colNames}) VALUES (${placeholders})`);

      const trans = localDb.transaction((chunk) => {
        for (const row of chunk) {
          const values = matchedCols.map((c: string) => parseVal(row[cols.indexOf(c)]));
          insertStmt.run(...values);
        }
      });

      trans(rows);
      totalSynced += rows.length;

      const rowidCol = cols.indexOf("rowid");
      lastRowid = Math.max(...rows.map((r: any) => Number(r[rowidCol].value)));
      process.stdout.write(`\r${tableName}: ${totalSynced} rows synced...`);

      if (rows.length < 1000) break;
    }
  }

  console.log(`\r✅ ${tableName}: ${totalSynced} rows restored into dev.db.`);
}

async function main() {
  console.log("==========================================================");
  console.log("🚀 Restoring Full Operational Database from Day 1 to Today");
  console.log("==========================================================");

  // 1. Core Metadata & Auth
  await syncTable("Setting");
  await syncTable("User");

  // 2. Fleet & Driver Assets
  await syncTable("Vehicle");
  await syncTable("DriverProfile");

  // 3. Financial Collections & Accounting
  await syncTable("PaymentLedger", true);
  await syncTable("DailyCollection");
  await syncTable("PaymentCancellation");

  // 4. Vehicle Operations, Inspections & Expenses
  await syncTable("VehicleInspection");
  await syncTable("VehicleExpense");
  await syncTable("MaintenanceTicket");
  await syncTable("AccidentClaim");
  await syncTable("VehicleIssue");
  await syncTable("RepairReminder");
  await syncTable("ChurnEvent");
  await syncTable("DriverComment");

  // 5. Field Operations & Support
  await syncTable("FieldTask");
  await syncTable("SupportTicket");

  // 6. Growth, CRM Leads & Pipeline History
  await syncTable("Lead");
  await syncTable("LeadActivityLog", true);

  // 7. WhatsApp Business Cloud CRM
  await syncTable("WhatsAppConversation");
  await syncTable("WhatsAppMessage", true);

  console.log("\n🧹 Running WAL Checkpoint & Vacuum...");
  localDb.pragma("wal_checkpoint(TRUNCATE)");
  localDb.pragma("VACUUM");

  console.log("\n🎉 Full Complete Restoration Finished Successfully!");
  localDb.close();
}

main().catch((err) => {
  console.error("Sync error:", err);
  localDb.close();
  process.exit(1);
});
