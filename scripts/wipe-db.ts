/**
 * GoCab CRM — Database Reset & Operational Wipe Script
 * 
 * Clears all operational test data (leads, vehicles, tickets, field tasks,
 * inspections, claims, collections, churn logs) while preserving the
 * primary Operations Manager account (mouad.koudia@gocab.io).
 * 
 * Works with both local SQLite (file:./dev.db) and remote Turso databases.
 * 
 * Run: npm run db:wipe
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { prisma } = require("../src/lib/prisma");

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
  "VehicleExpense",
  "Vehicle",
  "Lead",
  "Blacklist",
];

async function main() {
  console.log("==========================================");
  console.log("🧹 GOCAB CRM — DATABASE RESET IN PROGRESS");
  console.log("==========================================");

  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);
      console.log(`✓ Wiped table [${t}]`);
    } catch (e: any) {
      console.log(`- Skipping [${t}]: ${e.message}`);
    }
  }

  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: true },
  });

  console.log("\n==========================================");
  console.log("👤 PRESERVED USER ACCOUNTS:");
  console.log("==========================================");
  console.table(users);

  console.log("\n✅ Database wipe finished successfully! Ready for fresh data intake.\n");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Wipe failed:", e);
  process.exit(1);
});
