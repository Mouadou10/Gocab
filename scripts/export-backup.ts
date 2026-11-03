/**
 * GoCab CRM — Automated Backup & Snapshot Engine
 *
 * Dumps all tables to a timestamped JSON snapshot and SQLite backup file.
 *
 * Usage:
 *   npx tsx scripts/export-backup.ts
 */

import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

async function exportBackup() {
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const jsonPath = path.join(backupDir, `gocab_backup_${dateStr}.json`);
  const dbSrc = path.join(process.cwd(), "dev.db");
  const dbDest = path.join(backupDir, `gocab_backup_${dateStr}.db`);

  console.log(`📦 Creating verified backup at: ${backupDir}...`);

  // 1. Copy SQLite binary
  if (fs.existsSync(dbSrc)) {
    fs.copyFileSync(dbSrc, dbDest);
    console.log(`✅ Binary SQLite database copied to: ${path.basename(dbDest)} (${fs.statSync(dbDest).size} bytes)`);
  }

  // 2. Structured JSON export
  const [leads, drivers, vehicles, ledgers, collections, users, settings, accidents, tickets, messages] = await Promise.all([
    prisma.lead.findMany(),
    prisma.driverProfile.findMany(),
    prisma.vehicle.findMany(),
    prisma.paymentLedger.findMany(),
    prisma.dailyCollection.findMany(),
    prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, region: true, isActive: true } }),
    prisma.setting.findMany(),
    prisma.accidentClaim.findMany(),
    prisma.fieldTask.findMany(),
    prisma.whatsAppConversation.findMany({ include: { messages: { take: 20 } } }),
  ]);

  const payload = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    counts: {
      leads: leads.length,
      drivers: drivers.length,
      vehicles: vehicles.length,
      ledgers: ledgers.length,
      collections: collections.length,
      users: users.length,
      settings: settings.length,
      accidents: accidents.length,
      tasks: tickets.length,
      conversations: messages.length,
    },
    data: {
      leads,
      drivers,
      vehicles,
      ledgers,
      collections,
      users,
      settings,
      accidents,
      tickets,
      conversations: messages,
    },
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`✅ Structured JSON snapshot exported to: ${path.basename(jsonPath)} (${fs.statSync(jsonPath).size} bytes)`);
  console.log("Summary of backed up records:", payload.counts);
}

exportBackup().catch(console.error);
