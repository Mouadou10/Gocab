import { prisma } from "../src/lib/prisma";
import Papa from "papaparse";

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

async function main() {
  console.log("📥 Fetching Google Sheet CSV...");
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
  console.log(`📊 Total rows parsed from sheet: ${rows.length}`);

  const uniquePhonesInSheet = new Set<string>();
  let emptyPhoneCount = 0;
  let duplicateInSheetCount = 0;

  const validRows: Array<{
    name: string;
    city: string;
    sanitized_phone: string;
  }> = [];

  for (const r of rows) {
    const rawPhone = r["Numéro de téléphone"];
    const phone = sanitizePhone(rawPhone);
    if (!phone || phone.length < 12) {
      emptyPhoneCount++;
      continue;
    }
    if (uniquePhonesInSheet.has(phone)) {
      duplicateInSheetCount++;
      continue;
    }
    uniquePhonesInSheet.add(phone);

    const firstName = (r["Prénom"] || "").trim();
    const lastName = (r["nom"] || "").trim();
    const name = `${firstName} ${lastName}`.trim() || "Candidat Inconnu";
    const city = (r["Ville"] || "").trim() || "Casablanca";

    validRows.push({
      name,
      city,
      sanitized_phone: phone,
    });
  }

  console.log(`✅ Unique valid candidates in sheet: ${validRows.length}`);
  console.log(`⚠️ Empty/invalid phones: ${emptyPhoneCount}`);
  console.log(`⚠️ Duplicates within sheet: ${duplicateInSheetCount}`);

  // Fetch all existing leads from DB to check overlap
  console.log("🔍 Checking against existing database leads...");
  const sources = await prisma.lead.groupBy({ by: ['campaign_source'], _count: { id: true } });
  console.log("Existing campaign sources in DB:", sources);
  const existingLeads = await prisma.lead.findMany({
    select: {
      id: true,
      sanitized_phone: true,
      board_column: true,
      brand_status: true,
      training_status: true,
    },
  });

  const existingMap = new Map<string, typeof existingLeads[0]>();
  for (const l of existingLeads) {
    existingMap.set(l.sanitized_phone, l);
  }

  let alreadyInDb = 0;
  const inDbByCol: Record<string, number> = {};
  const brandPreFilterStatuses: Record<string, number> = {};
  let brandNewCount = 0;

  for (const r of validRows) {
    const existing = existingMap.get(r.sanitized_phone);
    if (existing) {
      alreadyInDb++;
      inDbByCol[existing.board_column] = (inDbByCol[existing.board_column] || 0) + 1;
      if (existing.board_column === "BRAND_PRE_FILTER") {
        const st = existing.brand_status || "None";
        brandPreFilterStatuses[st] = (brandPreFilterStatuses[st] || 0) + 1;
      }
    } else {
      brandNewCount++;
    }
  }

  console.log(`\n--- DB Comparison Results ---`);
  console.log(`Total leads in DB: ${existingLeads.length}`);
  console.log(`Already in DB from sheet: ${alreadyInDb}`);
  console.log(`Breakdown of existing in DB by column:`, inDbByCol);
  console.log(`BRAND_PRE_FILTER statuses:`, brandPreFilterStatuses);
  console.log(`✨ Brand NEW candidates to insert: ${brandNewCount}`);

  // Sample check of cities
  const citiesCount: Record<string, number> = {};
  for (const r of validRows) {
    citiesCount[r.city] = (citiesCount[r.city] || 0) + 1;
  }
  console.log(`Top 10 cities:`, Object.entries(citiesCount).sort((a,b) => b[1] - a[1]).slice(0, 10));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
