/**
 * GoCab CRM — Database Reset & Operational Wipe Script
 * 
 * Clears all operational test data (leads, vehicles, tickets, field tasks,
 * inspections, claims, collections, churn logs) while preserving the
 * primary Operations Manager account (mouad.koudia@gocab.io).
 * 
 * Run: npm run db:wipe
 */

import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "dev.db");
const db = new Database(dbPath);

const tables = [
  "MaintenanceTicket",
  "VehicleInspection",
  "DailyCollection",
  "PaymentCancellation",
  "FieldTask",
  "SupportTicket",
  "FieldInspectionNew",
  "PaymentLedger",
  "AccidentClaim",
  "WeeklyObjective",
  "ChurnEvent",
  "DriverProfile",
  "Vehicle",
  "Lead",
  "Blacklist",
];

console.log("==========================================");
console.log("🧹 GOCAB CRM — DATABASE RESET IN PROGRESS");
console.log("==========================================");

for (const t of tables) {
  try {
    const info = db.prepare(`DELETE FROM ${t}`).run();
    console.log(`✓ Wiped table [${t}]: ${info.changes} rows deleted`);
  } catch (e: any) {
    console.log(`- Skipping [${t}]: ${e.message}`);
  }
}

// Reclaim unused disk space
db.prepare("VACUUM").run();

const users = db.prepare("SELECT email, name, role FROM User").all();

console.log("\n==========================================");
console.log("👤 PRESERVED USER ACCOUNTS:");
console.log("==========================================");
console.table(users);

console.log("\n✅ Database wipe finished successfully! Ready for fresh data intake.\n");
db.close();
