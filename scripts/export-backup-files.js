const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.resolve(__dirname, "../dev.db");
const db = new Database(dbPath);

const outputDir = path.resolve(__dirname, "../backups");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const publicBackupsDir = path.resolve(__dirname, "../public/backups");
if (!fs.existsSync(publicBackupsDir)) {
  fs.mkdirSync(publicBackupsDir, { recursive: true });
}

function toCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      let val = row[h];
      if (val === null || val === undefined) return '""';
      if (val instanceof Date) val = val.toISOString();
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    lines.push(values.join(","));
  }
  return "\uFEFF" + lines.join("\r\n"); // Add UTF-8 BOM for Excel compatibility
}

function safeQuery(table) {
  try {
    return db.prepare(`SELECT * FROM "${table}"`).all();
  } catch (err) {
    console.warn(`Could not read table ${table}:`, err.message);
    return [];
  }
}

console.log("=== Generating GoCab CRM Backup Files ===");

// 1. Leads
const leads = safeQuery("Lead");
fs.writeFileSync(path.join(outputDir, "01_Leads_GoCab.csv"), toCsv(leads), "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "01_Leads_GoCab.csv"), toCsv(leads), "utf8");
console.log(`✓ 01_Leads_GoCab.csv (${leads.length} leads)`);

// 2. Chauffeurs / Driver Profiles
const drivers = safeQuery("DriverProfile");
fs.writeFileSync(path.join(outputDir, "02_Chauffeurs_GoCab.csv"), toCsv(drivers), "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "02_Chauffeurs_GoCab.csv"), toCsv(drivers), "utf8");
console.log(`✓ 02_Chauffeurs_GoCab.csv (${drivers.length} chauffeurs)`);

// 3. Vehicles
const vehicles = safeQuery("Vehicle");
fs.writeFileSync(path.join(outputDir, "03_Flotte_Vehicules_GoCab.csv"), toCsv(vehicles), "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "03_Flotte_Vehicules_GoCab.csv"), toCsv(vehicles), "utf8");
console.log(`✓ 03_Flotte_Vehicules_GoCab.csv (${vehicles.length} véhicules)`);

// 4. Payments
const payments = safeQuery("PaymentLedger");
fs.writeFileSync(path.join(outputDir, "04_Paiements_Encaissements_GoCab.csv"), toCsv(payments), "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "04_Paiements_Encaissements_GoCab.csv"), toCsv(payments), "utf8");
console.log(`✓ 04_Paiements_Encaissements_GoCab.csv (${payments.length} paiements)`);

// 5. Maintenance Tickets
const tickets = safeQuery("MaintenanceTicket");
fs.writeFileSync(path.join(outputDir, "05_Tickets_Maintenance_GoCab.csv"), toCsv(tickets), "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "05_Tickets_Maintenance_GoCab.csv"), toCsv(tickets), "utf8");
console.log(`✓ 05_Tickets_Maintenance_GoCab.csv (${tickets.length} tickets)`);

// 6. Field Tasks
const fieldTasks = safeQuery("FieldTask");
fs.writeFileSync(path.join(outputDir, "06_Missions_Terrain_GoCab.csv"), toCsv(fieldTasks), "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "06_Missions_Terrain_GoCab.csv"), toCsv(fieldTasks), "utf8");
console.log(`✓ 06_Missions_Terrain_GoCab.csv (${fieldTasks.length} missions)`);

// 7. Accidents
const accidents = safeQuery("AccidentReport");
fs.writeFileSync(path.join(outputDir, "07_Accidents_Assurance_GoCab.csv"), toCsv(accidents), "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "07_Accidents_Assurance_GoCab.csv"), toCsv(accidents), "utf8");
console.log(`✓ 07_Accidents_Assurance_GoCab.csv (${accidents.length} accidents)`);

// 8. WhatsApp Conversations
const waConvs = safeQuery("WhatsAppConversation");
fs.writeFileSync(path.join(outputDir, "08_WhatsApp_Conversations_GoCab.csv"), toCsv(waConvs), "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "08_WhatsApp_Conversations_GoCab.csv"), toCsv(waConvs), "utf8");
console.log(`✓ 08_WhatsApp_Conversations_GoCab.csv (${waConvs.length} conversations)`);

// 9. Full Master JSON Snapshot
const timestamp = new Date().toISOString();
const fullSnapshot = {
  system: "GoCab CRM",
  version: "2.0-production",
  timestamp,
  google_drive_target_folder: "1rpJPDuKMo8Tej0lk8LUAJxeGK4p4-wtr",
  folder_name: "GoCab Backups",
  counts: {
    leads: leads.length,
    drivers: drivers.length,
    vehicles: vehicles.length,
    payments: payments.length,
    tickets: tickets.length,
    fieldTasks: fieldTasks.length,
    accidents: accidents.length,
    whatsAppConversations: waConvs.length,
  },
  tables: {
    Lead: leads,
    DriverProfile: drivers,
    Vehicle: vehicles,
    PaymentLedger: payments,
    MaintenanceTicket: tickets,
    FieldTask: fieldTasks,
    AccidentReport: accidents,
    WhatsAppConversation: waConvs,
  },
};

const fullJsonStr = JSON.stringify(fullSnapshot, null, 2);
fs.writeFileSync(path.join(outputDir, "GoCab_Master_Snapshot_Latest.json"), fullJsonStr, "utf8");
fs.writeFileSync(path.join(publicBackupsDir, "GoCab_Master_Snapshot_Latest.json"), fullJsonStr, "utf8");
console.log(`✓ GoCab_Master_Snapshot_Latest.json (${(Buffer.byteLength(fullJsonStr) / 1024 / 1024).toFixed(2)} MB)`);

// Update Setting table in dev.db
const backupSettingData = {
  timestamp,
  success: true,
  method: "exported_ready_for_drive",
  message: `Sauvegarde locale complète générée avec succès (${leads.length} leads, ${vehicles.length} véhicules, ${drivers.length} chauffeurs, ${payments.length} paiements).`,
  counts: fullSnapshot.counts,
  folder_id: "1rpJPDuKMo8Tej0lk8LUAJxeGK4p4-wtr",
  folder_name: "GoCab Backups",
};

db.prepare(`
  INSERT INTO Setting (key, value)
  VALUES ('last_backup_google_drive', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`).run(JSON.stringify(backupSettingData));

console.log("\n✅ All backup files successfully generated and ready!");
