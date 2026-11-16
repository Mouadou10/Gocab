import fs from "node:fs";
import { parseSpreadsheetFile } from "../src/lib/spreadsheet";
import { prisma, flushDatabaseSync } from "../src/lib/prisma";
import { touchSyncState } from "../src/lib/sync";
import { invalidateLeadsCache } from "../src/lib/leads-cache";

function sanitizePhone(raw: string): string | null {
  if (!raw) return null;
  let cleaned = String(raw).replace(/[\s\-\.\(\)]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("212")) cleaned = cleaned.slice(3);
  cleaned = cleaned.replace(/^0+/, "");
  if (cleaned.length < 8) return null;
  return `+212${cleaned}`;
}

function cleanCity(raw: string): string {
  if (!raw) return "Casablanca";
  const c = raw.trim();
  const lower = c.toLowerCase();
  if (lower.includes("casa") || lower.includes("الدار البيضاء")) return "Casablanca";
  if (lower.includes("rabat") || lower.includes("الرباط")) return "Rabat";
  if (lower.includes("salé") || lower.includes("sale") || lower.includes("سلا")) return "Salé";
  if (lower.includes("tanger") || lower.includes("tangier") || lower.includes("طنجة") || lower.includes("tanja")) return "Tanger";
  if (lower.includes("marrakech") || lower.includes("marrakesh") || lower.includes("مراكش")) return "Marrakech";
  if (lower.includes("agadir") || lower.includes("أكادير")) return "Agadir";
  if (lower.includes("fès") || lower.includes("fes") || lower.includes("فاس")) return "Fès";
  if (lower.includes("meknes") || lower.includes("meknès") || lower.includes("مكناس")) return "Meknès";
  if (lower.includes("kenitra") || lower.includes("kénitra") || lower.includes("القنيطرة")) return "Kénitra";
  if (lower.includes("mohammedia") || lower.includes("المحمدية") || lower.includes("المحمديه")) return "Mohammedia";
  if (lower.includes("temara") || lower.includes("témara") || lower.includes("تمارة")) return "Témara";
  if (lower.includes("el jadida") || lower.includes("الجديدة")) return "El Jadida";
  if (lower.includes("tétouan") || lower.includes("tetouan") || lower.includes("تطوان")) return "Tétouan";
  return c;
}

async function syncGoogleSheetLeads() {
  console.log("=== Starting Google Sheet MG4 Ingestion / Sync ===");
  const csvPath = "scripts/downloaded_sheet_leads.csv";
  let csvText = "";
  if (fs.existsSync(csvPath)) {
    csvText = fs.readFileSync(csvPath, "utf-8");
  } else {
    console.log("Fetching live CSV from Google Sheets export URL...");
    const url = "https://docs.google.com/spreadsheets/d/172G1jrOEybNayB5caawpkLuAaMAcb6Hre9I_aMpK3WQ/export?format=csv&gid=1470793392";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch sheet CSV: ${res.statusText}`);
    csvText = await res.text();
  }
  const file = new File([Buffer.from(csvText)], "downloaded.csv", { type: "text/csv" });
  const { rows } = await parseSpreadsheetFile(file);

  console.log(`Read ${rows.length} rows from CSV`);

  const CAMPAIGN_NAME = "Campagne MG4 - Septembre 2026";

  // Map by sanitized phone
  const sheetLeadsMap = new Map<string, {
    fullName: string;
    city: string;
    sanitizedPhone: string;
  }>();

  for (const r of rows) {
    const firstName = String(r["Prénom"] || "").trim();
    const lastName = String(r["nom"] || "").trim();
    const fullName = `${firstName} ${lastName}`.trim() || "Prospect MG4";
    const rawCity = String(r["Ville"] || "").trim();
    const city = cleanCity(rawCity);
    const rawPhone = String(r["Numéro de téléphone"] || "").trim();
    const sanitized = sanitizePhone(rawPhone);

    if (sanitized && !sheetLeadsMap.has(sanitized)) {
      sheetLeadsMap.set(sanitized, {
        fullName,
        city,
        sanitizedPhone: sanitized,
      });
    }
  }

  console.log(`Unique valid leads to sync: ${sheetLeadsMap.size}`);

  // Fetch all leads currently in DB
  const allDbLeads = await prisma.lead.findMany({
    select: {
      id: true,
      sanitized_phone: true,
      board_column: true,
      brand_status: true,
      campaign_source: true,
    },
  });

  const dbByPhone = new Map<string, typeof allDbLeads[0]>();
  for (const l of allDbLeads) {
    dbByPhone.set(l.sanitized_phone, l);
  }

  // Identify active vehicle assignment drivers to preserve their contracts
  const activeVehiclePhones = new Set([
    '+212607902131', // Fayçal Waray (car 39457-Y-6)
    '+212664938225', // azedine kaddi (car WW028107)
  ]);

  const leadsToInsert: any[] = [];
  const leadsToUpdate: { id: string; data: any }[] = [];

  const now = new Date();

  for (const [phone, lead] of sheetLeadsMap.entries()) {
    const existing = dbByPhone.get(phone);

    if (!existing) {
      leadsToInsert.push({
        id: crypto.randomUUID(),
        raw_name: lead.fullName,
        sanitized_phone: lead.sanitizedPhone,
        city: lead.city,
        campaign_source: CAMPAIGN_NAME,
        board_column: "NEW_LEADS",
        brand_status: null,
        training_status: null,
        status_changed_at: null,
        is_archived: false,
        created_at: now,
        updated_at: now,
      });
    } else {
      const isCarDriver = activeVehiclePhones.has(phone);
      leadsToUpdate.push({
        id: existing.id,
        data: {
          raw_name: lead.fullName,
          city: lead.city,
          campaign_source: CAMPAIGN_NAME,
          ...(isCarDriver
            ? {} // keep active vehicle assignment
            : {
                board_column: "NEW_LEADS",
                brand_status: null,
                training_status: null,
                status_changed_at: null,
              }),
          is_archived: false,
          updated_at: now,
        },
      });
    }
  }

  console.log(`Leads to insert: ${leadsToInsert.length}`);
  console.log(`Leads to update: ${leadsToUpdate.length}`);

  // 1. Batch Insert
  if (leadsToInsert.length > 0) {
    for (let i = 0; i < leadsToInsert.length; i += 50) {
      const chunk = leadsToInsert.slice(i, i + 50);
      await prisma.lead.createMany({
        data: chunk,
      });
    }
    console.log(`Inserted ${leadsToInsert.length} new leads`);
  }

  // 2. Batch Update in chunks of 20 via $transaction with 30s timeout
  if (leadsToUpdate.length > 0) {
    for (let i = 0; i < leadsToUpdate.length; i += 20) {
      const chunk = leadsToUpdate.slice(i, i + 20);
      await prisma.$transaction(
        chunk.map((u) => prisma.lead.update({ where: { id: u.id }, data: u.data })),
        { timeout: 30000, maxWait: 10000 }
      );
      if (i % 100 === 0 || i + 20 >= leadsToUpdate.length) {
        console.log(`Updated ${Math.min(i + 20, leadsToUpdate.length)} / ${leadsToUpdate.length} leads...`);
      }
    }
    console.log(`Finished updating ${leadsToUpdate.length} leads.`);
  }

  invalidateLeadsCache();
  await flushDatabaseSync();
  await touchSyncState("leads");
  console.log("✅ Sync complete! All Google Sheet leads are now fresh NEW_LEADS with source 'Campagne MG4 - Septembre 2026'.");
}

syncGoogleSheetLeads().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
