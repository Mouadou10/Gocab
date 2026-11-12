/**
 * Script to import leads from Google Sheet into GoCab CRM as NEW_LEADS
 * Sheet URL: https://docs.google.com/spreadsheets/d/172G1jrOEybNayB5caawpkLuAaMAcb6Hre9I_aMpK3WQ/edit?gid=1470793392#gid=1470793392
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { v4 as uuidv4 } from "uuid";
import Papa from "papaparse";
import { prisma } from "../src/lib/prisma";
import { touchSyncState } from "../src/lib/sync";
import { invalidateLeadsCache } from "../src/lib/leads-cache";

function sanitizePhone(raw: string): string {
  let cleaned = (raw || "").replace(/[\s\-\.\(\)]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("212")) cleaned = cleaned.slice(3);
  cleaned = cleaned.replace(/^0+/, "");
  if (cleaned.length >= 8) {
    return `+212${cleaned}`;
  }
  return cleaned ? `+212${cleaned}` : "";
}

function normalizeCity(rawCity: string): string {
  const norm = (rawCity || "").trim().toLowerCase();
  if (!norm) return "Casablanca";
  if (norm.includes("casa") || norm.includes("بيضاء")) return "Casablanca";
  if (norm.includes("rabat") || norm.includes("رباط")) return "Rabat";
  if (norm.includes("kenitra") || norm.includes("kénitra") || norm.includes("قنيطرة")) return "Kenitra";
  if (norm.includes("tanger") || norm.includes("tangier") || norm.includes("طنجة")) return "Tanger";
  if (norm.includes("salé") || norm.includes("sale") || norm.includes("سلا")) return "Salé";
  if (norm.includes("marrakech") || norm.includes("مراكش")) return "Marrakech";
  if (norm.includes("fes") || norm.includes("fès") || norm.includes("فاس")) return "Fès";
  if (norm.includes("agadir") || norm.includes("أكادير") || norm.includes("اكادير")) return "Agadir";
  if (norm.includes("meknes") || norm.includes("meknès") || norm.includes("مكناس")) return "Meknès";
  if (norm.includes("mohammedia") || norm.includes("محمدية")) return "Mohammedia";
  if (norm.includes("temara") || norm.includes("témara") || norm.includes("تمارة")) return "Témara";
  if (norm.includes("jadida") || norm.includes("جديدة")) return "El Jadida";
  if (norm.includes("oujda") || norm.includes("وجدة")) return "Oujda";
  if (norm.includes("nador") || norm.includes("ناظور")) return "Nador";
  if (norm.includes("tetouan") || norm.includes("tétouan") || norm.includes("تطوان")) return "Tétouan";

  // Return capitalized first letter
  return rawCity.trim().charAt(0).toUpperCase() + rawCity.trim().slice(1);
}

async function run() {
  console.log("⚡ Starting Google Sheet Leads Import...");
  const url = "https://docs.google.com/spreadsheets/d/172G1jrOEybNayB5caawpkLuAaMAcb6Hre9I_aMpK3WQ/export?format=csv&gid=1470793392";
  
  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) {
    throw new Error(`Failed to fetch sheet: ${resp.status} ${resp.statusText}`);
  }
  const csvText = await resp.text();

  const parsed = Papa.parse<{
    "Prénom": string;
    "nom": string;
    "Ville": string;
    "Numéro de téléphone": string;
  }>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  console.log(`📊 Fetched ${rows.length} rows from Google Sheet.`);

  // 1. Fetch existing phones from DB to avoid collision with unique constraint
  const existingLeads = await prisma.lead.findMany({
    select: {
      id: true,
      sanitized_phone: true,
      board_column: true,
    },
  });

  const existingPhoneMap = new Map<string, string>();
  for (const l of existingLeads) {
    existingPhoneMap.set(l.sanitized_phone, l.board_column);
  }

  const seenInBatch = new Set<string>();
  const leadsToInsert: any[] = [];
  let skippedDuplicatesInSheet = 0;
  let skippedAlreadyInDb = 0;
  let invalidPhoneCount = 0;

  const now = new Date();

  for (const r of rows) {
    const rawPhone = r["Numéro de téléphone"];
    const sanitized_phone = sanitizePhone(rawPhone);

    if (!sanitized_phone || sanitized_phone.length < 12) {
      invalidPhoneCount++;
      continue;
    }

    if (seenInBatch.has(sanitized_phone)) {
      skippedDuplicatesInSheet++;
      continue;
    }
    seenInBatch.add(sanitized_phone);

    if (existingPhoneMap.has(sanitized_phone)) {
      skippedAlreadyInDb++;
      continue;
    }

    const firstName = (r["Prénom"] || "").trim();
    const lastName = (r["nom"] || "").trim();
    const raw_name = `${firstName} ${lastName}`.trim() || "Candidat";
    const city = normalizeCity(r["Ville"]);

    leadsToInsert.push({
      id: uuidv4(),
      raw_name,
      sanitized_phone,
      campaign_source: "Google Sheets Import",
      board_column: "NEW_LEADS",
      brand_status: null,
      training_status: null,
      reminder_date: null,
      city,
      has_cin: false,
      has_fiche_anthropometrique: false,
      has_confirmation_adresse: false,
      has_permis: false,
      presence_confirmed: false,
      whatsapp_invite_sent: false,
      is_archived: false,
      notes: null,
      created_at: now,
      updated_at: now,
    });
  }

  console.log(`\n📋 Pre-import validation summary:`);
  console.log(`- Total valid candidate rows in sheet: ${seenInBatch.size}`);
  console.log(`- Invalid/empty phone numbers: ${invalidPhoneCount}`);
  console.log(`- Duplicate entries within sheet: ${skippedDuplicatesInSheet}`);
  console.log(`- Already existing in CRM database (preserved): ${skippedAlreadyInDb}`);
  console.log(`- ✨ NEW LEADS ready to be inserted: ${leadsToInsert.length}`);

  if (leadsToInsert.length === 0) {
    console.log("No new leads to insert. Process completed.");
    return;
  }

  // Insert in chunks of 200
  const CHUNK_SIZE = 200;
  let insertedTotal = 0;

  for (let i = 0; i < leadsToInsert.length; i += CHUNK_SIZE) {
    const chunk = leadsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.lead.createMany({
      data: chunk,
    });
    insertedTotal += chunk.length;
    console.log(`  Inserted batch: ${insertedTotal} / ${leadsToInsert.length}`);
  }

  console.log(`\n✅ Successfully inserted ${insertedTotal} new leads into NEW_LEADS!`);

  // Invalidate in-memory cache and broadcast sync update
  invalidateLeadsCache();
  await touchSyncState("leads").catch(() => {});
  console.log("🔄 LiveSync broadcasted & leads cache invalidated.");

  // Verification count
  const newLeadsCount = await prisma.lead.count({
    where: { board_column: "NEW_LEADS" },
  });
  const totalLeadsCount = await prisma.lead.count();

  console.log(`\n📊 Current CRM Database Stats:`);
  console.log(`- Total NEW_LEADS in CRM: ${newLeadsCount}`);
  console.log(`- Total Leads in CRM: ${totalLeadsCount}`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  });
