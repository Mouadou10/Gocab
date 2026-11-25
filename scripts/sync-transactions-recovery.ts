import fs from "node:fs";
import { parseSpreadsheetFile } from "../src/lib/spreadsheet";
import { prisma, flushDatabaseSync } from "../src/lib/prisma";
import { touchSyncState } from "../src/lib/sync";

async function main() {
  const filePath = process.argv[2];
  const targetDate = process.argv[3] || "2026-11-24";
  const applyDb = process.argv.includes("--apply");

  if (!filePath || !fs.existsSync(filePath)) {
    console.error("Usage: node --import tsx scripts/sync-transactions-recovery.ts <xlsx> [YYYY-MM-DD] [--apply]");
    process.exit(1);
  }

  const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

  const ledgers = await prisma.paymentLedger.findMany({
    where: { paymentDate: { gte: startOfDay, lte: endOfDay } },
    include: { driver: { select: { id: true, fullName: true, phoneSanitized: true } } },
  });

  const byName = new Map<string, (typeof ledgers)[0]>();
  const byPhone = new Map<string, (typeof ledgers)[0]>();
  for (const l of ledgers) {
    byName.set(l.driver.fullName.toLowerCase().replace(/\s+/g, " ").trim(), l);
    const p = (l.driver.phoneSanitized || "").replace(/\D/g, "").slice(-9);
    if (p) byPhone.set(p, l);
  }

  const buffer = fs.readFileSync(filePath);
  const file = new File([buffer], "transactions.xlsx");
  const { rows } = await parseSpreadsheetFile(file);

  const perDriverCashin = new Map<string, { ledger: (typeof ledgers)[0]; total: number; count: number }>();
  const excludedNewDrivers: { driverName: string; amt: number; cat: string }[] = [];
  const nonCashin: { driver: string; amt: number; cat: string }[] = [];

  for (const r of rows) {
    const type = String(r["Type"] || "").toLowerCase().trim();
    if (type !== "credit") continue;

    const amt = Number(String(r["Amount"] || 0).replace(/[^0-9.-]/g, "")) || 0;
    const driverName = String(r["Driver"] || "").replace(/\s+/g, " ").trim();
    const cat = String(r["Category"] || "").toLowerCase().trim();
    const lbl = String(r["Label"] || "");
    const phone = String(r["Phone Number"] || "").replace(/\D/g, "").slice(-9);

    const ledger = byName.get(driverName.toLowerCase()) || (phone ? byPhone.get(phone) : undefined);
    if (!ledger) {
      excludedNewDrivers.push({ driverName, amt, cat });
      continue;
    }

    if (cat !== "cashin" || /bail/i.test(lbl)) {
      nonCashin.push({ driver: ledger.driver.fullName, amt, cat });
      continue;
    }

    const existing = perDriverCashin.get(ledger.id) || { ledger, total: 0, count: 0 };
    existing.total += amt;
    existing.count += 1;
    perDriverCashin.set(ledger.id, existing);
  }

  let cashinTotal = 0;
  for (const entry of perDriverCashin.values()) cashinTotal += entry.total;

  console.log("TARGET_DATE:", targetDate);
  console.log("LEDGER_DRIVERS_COUNT:", ledgers.length);
  console.log("ACTIVE_DRIVERS_PAID_COUNT:", perDriverCashin.size);
  console.log("CASHIN_TOTAL_MAD:", cashinTotal);
  console.log("EXCLUDED_NEW_DRIVERS:", JSON.stringify(excludedNewDrivers));
  console.log("NON_CASHIN_P2P:", JSON.stringify(nonCashin));

  if (applyDb) {
    for (const { ledger, total, count } of perDriverCashin.values()) {
      const morningBal = ledger.morningBalance ?? 0;
      const eveningBal = morningBal + total;
      await prisma.paymentLedger.update({
        where: { id: ledger.id },
        data: {
          clearedMAD: total,
          calculatedDelta: total,
          eveningBalance: eveningBal,
          notes: `Recovered from Fleet Transactions (${count} cashin tx = ${total} MAD)`,
        },
      });
    }
    // Mark remaining unpaid active drivers for that day with eveningBalance = morningBalance (0 collected)
    for (const l of ledgers) {
      if (!perDriverCashin.has(l.id) && l.eveningBalance === null) {
        await prisma.paymentLedger.update({
          where: { id: l.id },
          data: {
            eveningBalance: l.morningBalance ?? 0,
            calculatedDelta: 0,
          },
        });
      }
    }
    await touchSyncState("collections");
    await flushDatabaseSync().catch(() => {});
    console.log("APPLIED_TO_DB: OK");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
