import { NextRequest, NextResponse } from "next/server";
import { prisma, flushDatabaseSync } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { parseSpreadsheetFile } from "@/lib/spreadsheet";
import { invalidateDriverCache } from "@/lib/driverCache";

/**
 * Normalizes phone numbers to comparable digits-only format.
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("212") && digits.length >= 11) {
    return digits.slice(-9); // last 9 digits (e.g. 645398932)
  }
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

/**
 * Normalizes name strings for fuzzy/accent-insensitive comparison.
 */
function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes vehicle license plate number.
 * Strips parenthesized city/hub info (e.g. "(Casablanca1)"), converts Arabic characters (ي -> Y, etc.),
 * and normalizes hyphenation.
 */
function normalizePlate(plate: string): string {
  if (!plate) return "";
  let clean = plate
    .replace(/\s*\(.*?\)/g, "") // strip parenthesized text like (Casablanca1)
    .replace(/\s*\[.*?\]/g, "")
    .toUpperCase();

  // Arabic letter transliteration commonly seen on Moroccan plates
  clean = clean
    .replace(/ي/g, "Y")
    .replace(/أ|إ|آ|ا/g, "A")
    .replace(/ب/g, "B")
    .replace(/د/g, "D")
    .replace(/ه/g, "H")
    .replace(/و/g, "W")
    .replace(/ج/g, "J")
    .replace(/ط/g, "T")
    .replace(/س/g, "S")
    .replace(/م/g, "M")
    .replace(/ر/g, "R");

  return clean
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

/**
 * Strips all non-alphanumeric chars for ultra-fuzzy plate matching (e.g. 26517Y6 or WW028124).
 */
function compactPlate(plate: string): string {
  return normalizePlate(plate).replace(/[^A-Z0-9]/g, "");
}

/**
 * Parses numeric balance from string (e.g. "-3000", "-2,800.00 MAD", "1500").
 */
function parseBalance(val: any): number | null {
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (!val) return null;
  if (typeof val !== "string") val = String(val);
  const s = val.trim();
  if (!s) return null;

  // Detect negative indicators: leading/trailing minus, parentheses like (1800), or -MAD
  const isParenNegative = /^\(.*\)$/.test(s);
  const hasMinus = s.includes("-") || isParenNegative;

  // Extract only digits, period, and comma
  let numStr = s.replace(/[^0-9.,]/g, "");
  if (!numStr) return null;

  if (numStr.includes(",") && numStr.includes(".")) {
    // Both comma and dot present
    if (numStr.lastIndexOf(",") > numStr.lastIndexOf(".")) {
      // e.g. "1.800,00" -> 1800.00
      numStr = numStr.replace(/\./g, "").replace(",", ".");
    } else {
      // e.g. "1,800.00" -> 1800.00
      numStr = numStr.replace(/,/g, "");
    }
  } else if (numStr.includes(",")) {
    const parts = numStr.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      numStr = `${parts[0]}.${parts[1]}`;
    } else {
      numStr = numStr.replace(/,/g, "");
    }
  }

  const num = parseFloat(numStr);
  if (isNaN(num)) return null;
  return hasMinus ? -Math.abs(num) : Math.abs(num);
}

/**
 * Dynamically detects spreadsheet column headers.
 */
function detectHeaders(firstRow: any) {
  if (!firstRow) return {} as any;
  const keys = Object.keys(firstRow);

  const nameKey =
    keys.find((k) => /^(name|driver\s*name|nom|chauffeur|full\s*name)$/i.test(k.trim())) ||
    keys.find((k) => /name|nom/i.test(k));

  const phoneKey =
    keys.find((k) => /^(phone|phone\s*number|telephone|tel|num|mobile)$/i.test(k.trim())) ||
    keys.find((k) => /phone|tel/i.test(k));

  const cinKey =
    keys.find((k) => /^(id\s*number|cin|cnie|piece\s*identite)$/i.test(k.trim())) ||
    keys.find((k) => /id\s*number|cin/i.test(k));

  const plateKey =
    keys.find((k) => /^(plate|plate\s*number|immatriculation|matricule|vehicule|vehicules|vehicle|vehicles|car|cars)$/i.test(k.trim())) ||
    keys.find((k) => /plate|immat|matricule|vehicle|vehicule/i.test(k));

  const makeModelKey =
    keys.find((k) => /^(make|model|make\s*model|marque|modele|car\s*model)$/i.test(k.trim())) ||
    keys.find((k) => /model|marque/i.test(k));

  const statusKey =
    keys.find((k) => /^(status|statut|etat|vehicle\s*status)$/i.test(k.trim())) ||
    keys.find((k) => /status|statut/i.test(k) && !/activation|driver/i.test(k));

  const contractKey =
    keys.find((k) => /^(contract|contrat|contract\s*type|type\s*contrat)$/i.test(k.trim())) ||
    keys.find((k) => /contract|contrat/i.test(k));

  const cityKey =
    keys.find((k) => /^(city|ville|hub|region)$/i.test(k.trim())) ||
    keys.find((k) => /city|ville|hub/i.test(k));

  const morningBalanceKey =
    keys.find((k) => /solde\s*matin|balance\s*matin|solde\s*debut|solde\s*initial|morning\s*balance/i.test(k.trim())) ||
    keys.find((k) => /matin|morning/i.test(k));

  const eveningBalanceKey =
    keys.find((k) => /solde\s*soir|balance\s*soir|solde\s*fin|solde\s*final|evening\s*balance/i.test(k.trim())) ||
    keys.find((k) => /soir|evening/i.test(k));

  const genericBalanceKey =
    keys.find((k) => /^(balance|solde|current\s*balance|total\s*balance|impayes|arrears)$/i.test(k.trim())) ||
    keys.find((k) => /balance|solde|impaye/i.test(k));

  const paymentKey =
    keys.find((k) => /^(versement|paiement|payment|cleared|paye|amount\s*paid|montant\s*verse|reglement|recouvrement|encaissement|encaisse|espece|cash|virement|recu|depot|total\s*paye|somme\s*versee|clearedmad)$/i.test(k.trim())) ||
    keys.find((k) => /versement|paiement|payment|cleared|paye|reglement|recouvrement|encaissement/i.test(k));

  return {
    nameKey,
    phoneKey,
    cinKey,
    plateKey,
    makeModelKey,
    statusKey,
    contractKey,
    cityKey,
    morningBalanceKey,
    eveningBalanceKey,
    genericBalanceKey,
    paymentKey,
  };
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const singleFile = formData.get("file") as File | null;
    const morningFile = (formData.get("morningFile") || formData.get("fileMorning")) as File | null;
    const eveningFile = (formData.get("eveningFile") || formData.get("fileEvening")) as File | null;
    const reqMode = ((formData.get("mode") as string) || "MORNING").toUpperCase(); // "MORNING", "EVENING", or "DUAL"
    const dateParam = (formData.get("date") as string) || new Date().toISOString().split("T")[0];

    // Determine target business date
    const targetDate = new Date(`${dateParam}T12:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay();
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // If Monday (dayOfWeek === 1), fetch previous Friday through Sunday ledgers to compare balances
    const fridayDate = new Date(targetDate);
    fridayDate.setUTCDate(fridayDate.getUTCDate() - 3);
    const startOfFriday = new Date(fridayDate);
    startOfFriday.setUTCHours(0, 0, 0, 0);

    // Fetch all active drivers, vehicles, and prior ledgers on Monday from database
    const [allDrivers, allVehicles, priorLedgers] = await Promise.all([
      prisma.driverProfile.findMany({
        include: {
          assignedVehicle: true,
          payments: {
            where: {
              paymentDate: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          },
        },
      }),
      prisma.vehicle.findMany(),
      dayOfWeek === 1
        ? prisma.paymentLedger.findMany({
            where: {
              paymentDate: {
                gte: startOfFriday,
                lt: startOfDay,
              },
            },
            orderBy: {
              paymentDate: "desc",
            },
          })
        : Promise.resolve([] as any[]),
    ]);

    // Map driverId -> most recent prior ledger (Friday evening/morning)
    const priorLedgerMap = new Map<string, (typeof priorLedgers)[0]>();
    for (const pl of priorLedgers) {
      if (!priorLedgerMap.has(pl.driverId)) {
        priorLedgerMap.set(pl.driverId, pl);
      }
    }

    // Build fast lookup maps
    const phoneMap = new Map<string, typeof allDrivers[0]>();
    const nameMap = new Map<string, typeof allDrivers[0]>();
    const cinMap = new Map<string, typeof allDrivers[0]>();
    const plateMap = new Map<string, typeof allVehicles[0]>();

    for (const d of allDrivers) {
      const pNorm = normalizePhone(d.phoneSanitized);
      if (pNorm) phoneMap.set(pNorm, d);

      const nNorm = normalizeName(d.fullName);
      if (nNorm) nameMap.set(nNorm, d);

      if (d.cinNumber) cinMap.set(d.cinNumber.toUpperCase().trim(), d);
    }

    for (const v of allVehicles) {
      const pNorm = normalizePlate(v.plate_number);
      const cNorm = compactPlate(v.plate_number);
      if (pNorm) plateMap.set(pNorm, v);
      if (cNorm) plateMap.set(cNorm, v);

      if (cNorm.includes("WW")) {
        const digits = cNorm.replace(/WW/g, "");
        if (digits) {
          plateMap.set(`WW${digits}`, v);
          plateMap.set(`${digits}WW`, v);
        }
      }

      if (v.notes) {
        const matchOld = v.notes.match(/Ancien\s*N°?:\s*([A-Za-z0-9-]+)/i);
        if (matchOld && matchOld[1]) {
          const oldNorm = normalizePlate(matchOld[1]);
          const oldComp = compactPlate(matchOld[1]);
          if (oldNorm && !plateMap.has(oldNorm)) plateMap.set(oldNorm, v);
          if (oldComp && !plateMap.has(oldComp)) plateMap.set(oldComp, v);
        }
        const matchEnreg = v.notes.match(/Enreg:\s*([A-Za-z0-9\s-]+)/i);
        if (matchEnreg && matchEnreg[1]) {
          const enregNorm = normalizePlate(matchEnreg[1]);
          const enregComp = compactPlate(matchEnreg[1]);
          if (enregNorm && !plateMap.has(enregNorm)) plateMap.set(enregNorm, v);
          if (enregComp && !plateMap.has(enregComp)) plateMap.set(enregComp, v);
        }
      }
    }

    // Determine operation mode & parse spreadsheet file(s)
    let isDualFiles = !!(morningFile && eveningFile);
    let morningRows: any[] = [];
    let eveningRows: any[] = [];
    let singleRows: any[] = [];

    if (isDualFiles) {
      const mParsed = await parseSpreadsheetFile(morningFile!);
      const eParsed = await parseSpreadsheetFile(eveningFile!);
      morningRows = mParsed.rows;
      eveningRows = eParsed.rows;
      if (morningRows.length === 0 || eveningRows.length === 0) {
        return NextResponse.json({ error: "L'un des fichiers fournis (Matin ou Soir) est vide ou illisible." }, { status: 400 });
      }
    } else {
      const targetFile = singleFile || morningFile || eveningFile;
      if (!targetFile) {
        return NextResponse.json({ error: "Veuillez fournir un fichier CSV ou Excel (.xlsx)." }, { status: 400 });
      }
      const parsed = await parseSpreadsheetFile(targetFile);
      singleRows = parsed.rows;
      if (singleRows.length === 0) {
        return NextResponse.json({ error: "Le fichier est vide ou illisible." }, { status: 400 });
      }
    }

    const matchedDriversList: any[] = [];
    const unmatchedRows: any[] = [];
    const reassignedVehicles: { plate: string; previousDriver: string; newDriver: string }[] = [];
    let totalCollectedToday = 0;
    let totalMorningTargetMAD = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let newDriversCreated = 0;
    let newVehiclesCreated = 0;

    // Helper to resolve or link driver and vehicle for any row
    const resolveDriverAndVehicle = async (row: any, hdrs: ReturnType<typeof detectHeaders>) => {
      const rawPlate = hdrs.plateKey ? row[hdrs.plateKey]?.trim() : "";
      const rawMakeModel = hdrs.makeModelKey ? row[hdrs.makeModelKey]?.trim() : "";
      const rawStatus = hdrs.statusKey ? row[hdrs.statusKey]?.trim() : "";
      const rawCity = hdrs.cityKey ? row[hdrs.cityKey]?.trim() : "";
      const rawName = hdrs.nameKey ? row[hdrs.nameKey]?.trim() : "";
      const rawPhone = hdrs.phoneKey ? row[hdrs.phoneKey]?.trim() : "";
      const rawCin = hdrs.cinKey ? row[hdrs.cinKey]?.trim() : "";

      let vehicle = null;
      if (rawPlate) {
        const normPlate = normalizePlate(rawPlate);
        const compPlate = compactPlate(rawPlate);
        if (normPlate) {
          vehicle = plateMap.get(normPlate) || plateMap.get(compPlate);
          if (!vehicle && compPlate.includes("WW")) {
            const digits = compPlate.replace(/WW/g, "");
            if (digits) vehicle = plateMap.get(`WW${digits}`) || plateMap.get(`${digits}WW`) || null;
          }
          if (!vehicle && rawPhone) {
            const pNorm = normalizePhone(rawPhone);
            const d = pNorm ? phoneMap.get(pNorm) : undefined;
            if (d?.assignedVehicleId) {
              vehicle = allVehicles.find((av) => av.id === d.assignedVehicleId) || null;
            }
          }
          if (!vehicle && rawName) {
            const nNorm = normalizeName(rawName);
            const d = nNorm ? nameMap.get(nNorm) : undefined;
            if (d?.assignedVehicleId) {
              vehicle = allVehicles.find((av) => av.id === d.assignedVehicleId) || null;
            }
          }

          const normalizedStatus = rawStatus
            ? /^(working|actif|activated|in\s*service|en\s*service)$/i.test(rawStatus)
              ? "Actif"
              : /^(available|disponible)$/i.test(rawStatus)
              ? "Available"
              : /^(maintenance|garage|in\s*garage)$/i.test(rawStatus)
              ? "In garage"
              : rawStatus
            : "";

          if (!vehicle) {
            try {
              vehicle = await prisma.vehicle.create({
                data: {
                  plate_number: normPlate,
                  make_model: rawMakeModel || "Dacia Logan 1.5 dCi",
                  year: 2023,
                  hub_city: rawCity || "Casablanca",
                  status: normalizedStatus || "Actif",
                  assigned_driver_name: rawName || null,
                  assigned_driver_phone: rawPhone || null,
                },
              });
              plateMap.set(normPlate, vehicle);
              if (compPlate) plateMap.set(compPlate, vehicle);
            } catch (e) {
              vehicle = plateMap.get(normPlate) || plateMap.get(compPlate) || null;
            }
          }
        }
      }

      let driver: typeof allDrivers[0] | undefined;
      if (rawPhone) {
        const pNorm = normalizePhone(rawPhone);
        driver = phoneMap.get(pNorm);
      }
      if (!driver && rawCin) {
        driver = cinMap.get(rawCin.toUpperCase().trim());
      }
      if (!driver && rawName) {
        const nNorm = normalizeName(rawName);
        driver = nameMap.get(nNorm);
        if (!driver) {
          const parts = nNorm.split(" ").filter((p: string) => p.length >= 3);
          for (const d of allDrivers) {
            const dNorm = normalizeName(d.fullName);
            if (parts.length >= 2 && parts.every((p: string) => dNorm.includes(p))) {
              driver = d;
              break;
            }
          }
        }
      }
      if (!driver && vehicle?.id) {
        const vDriver = allDrivers.find((d) => d.assignedVehicleId === vehicle!.id);
        if (vDriver) {
          if (!rawName) driver = vDriver;
          else {
            const vNorm = normalizeName(vDriver.fullName);
            const rNorm = normalizeName(rawName);
            if (vNorm === rNorm || vNorm.includes(rNorm) || rNorm.includes(vNorm)) {
              driver = vDriver;
            }
          }
        }
      }

      // Auto-link driver to vehicle if plate is present in spreadsheet
      if (driver && vehicle && driver.assignedVehicleId !== vehicle.id) {
        try {
          await prisma.driverProfile.updateMany({
            where: {
              assignedVehicleId: vehicle.id,
              id: { not: driver.id },
            },
            data: { assignedVehicleId: null },
          });

          await prisma.driverProfile.update({
            where: { id: driver.id },
            data: {
              assignedVehicleId: vehicle.id,
              is_archived: false,
            },
          });

          await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: {
              assigned_driver_name: driver.fullName,
              assigned_driver_phone: driver.phoneSanitized,
              status: "Actif",
            },
          });

          reassignedVehicles.push({
            plate: vehicle.plate_number,
            previousDriver: vehicle.assigned_driver_name || "Non assigné",
            newDriver: driver.fullName,
          });

          driver.assignedVehicleId = vehicle.id;
          driver.is_archived = false;
        } catch (linkErr) {
          console.warn("Auto-linking driver to vehicle failed:", linkErr);
        }
      } else if (driver && driver.is_archived) {
        try {
          await prisma.driverProfile.update({
            where: { id: driver.id },
            data: { is_archived: false },
          });
          driver.is_archived = false;
        } catch (e) {}
      }

      return { driver, vehicle };
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // CASE 1: DUAL FILES (User provided separate Morning and Evening files)
    // ─────────────────────────────────────────────────────────────────────────────
    if (isDualFiles) {
      const mHdrs = detectHeaders(morningRows[0]);
      const eHdrs = detectHeaders(eveningRows[0]);

      // Map driverId -> Morning Row Info
      const driverMorningMap = new Map<string, { balance: number; vehicle: any; contract?: string }>();
      for (let i = 0; i < morningRows.length; i++) {
        const row = morningRows[i];
        const rawBal = mHdrs.morningBalanceKey || mHdrs.genericBalanceKey ? row[mHdrs.morningBalanceKey || mHdrs.genericBalanceKey] : undefined;
        const bal = parseBalance(rawBal) ?? 0;
        const { driver, vehicle } = await resolveDriverAndVehicle(row, mHdrs);
        if (driver) {
          driverMorningMap.set(driver.id, {
            balance: bal,
            vehicle,
            contract: mHdrs.contractKey ? row[mHdrs.contractKey] : undefined,
          });
        }
      }

      // Process Evening Rows & Reconcile
      const processedDrivers = new Set<string>();
      for (let i = 0; i < eveningRows.length; i++) {
        const row = eveningRows[i];
        const rawBal = eHdrs.eveningBalanceKey || eHdrs.genericBalanceKey ? row[eHdrs.eveningBalanceKey || eHdrs.genericBalanceKey] : undefined;
        const rawPay = eHdrs.paymentKey ? row[eHdrs.paymentKey] : undefined;
        const eveningBal = parseBalance(rawBal) ?? 0;
        const directPayment = parseBalance(rawPay) !== null ? Math.max(0, parseBalance(rawPay)!) : 0;

        const { driver, vehicle } = await resolveDriverAndVehicle(row, eHdrs);
        if (!driver) {
          unmatchedRows.push({
            rowNumber: i + 2,
            name: eHdrs.nameKey ? row[eHdrs.nameKey] : "Inconnu",
            phone: eHdrs.phoneKey ? row[eHdrs.phoneKey] : "-",
            balance: eveningBal,
          });
          continue;
        }

        processedDrivers.add(driver.id);
        const mInfo = driverMorningMap.get(driver.id);
        const existingLedger = driver.payments?.[0] || null;

        const morningBal =
          mInfo !== undefined
            ? mInfo.balance
            : existingLedger?.morningBalance !== undefined && existingLedger?.morningBalance !== null
            ? existingLedger.morningBalance
            : -driver.currentArrearsMAD;

        const morningArrears = morningBal < 0 ? Math.abs(morningBal) : 0;
        totalMorningTargetMAD += morningArrears;

        let contract = (mInfo?.contract || driver.contractType || "DAILY").toUpperCase();
        let expectedMAD = 0;
        if (contract === "WEEKLY") {
          if (dayOfWeek === 1) expectedMAD = 1800;
        } else {
          if (dayOfWeek >= 1 && dayOfWeek <= 6) expectedMAD = 300;
        }

        let calculatedDelta = 0;
        if (morningBal <= 0 && eveningBal >= morningBal) {
          calculatedDelta = eveningBal - morningBal;
        } else if (morningBal > 0 && eveningBal <= morningBal) {
          calculatedDelta = morningBal - eveningBal;
        }

        let collected = directPayment > 0 ? Math.max(directPayment, calculatedDelta) : calculatedDelta;
        collected = Math.max(0, Math.round(collected * 100) / 100);
        totalCollectedToday += collected;

        let payStatus: "PAID" | "PARTIAL" | "UNPAID" = "UNPAID";
        if (collected >= expectedMAD && expectedMAD > 0) {
          payStatus = "PAID";
          paidCount++;
        } else if (collected > 0) {
          payStatus = "PARTIAL";
          partialCount++;
        } else {
          payStatus = "UNPAID";
          unpaidCount++;
        }

        const newArrears = eveningBal !== 0 ? (eveningBal < 0 ? Math.abs(eveningBal) : 0) : Math.max(0, morningArrears - collected);
        const newUnpaidDays = collected >= expectedMAD && expectedMAD > 0 ? 0 : Math.max(1, (driver.consecutiveUnpaidDays || 0) + 1);

        if (existingLedger) {
          await prisma.paymentLedger.update({
            where: { id: existingLedger.id },
            data: {
              morningBalance: morningBal,
              eveningBalance: eveningBal,
              clearedMAD: collected,
              calculatedDelta: collected,
              arrearsMAD: newArrears,
              expectedMAD: expectedMAD || existingLedger.expectedMAD,
              notes: `Rapprochement Matin + Soir: Matin ${morningBal} MAD ➔ Soir ${eveningBal} MAD (Encaissé: ${collected} MAD)`,
            },
          });
        } else {
          await prisma.paymentLedger.create({
            data: {
              driverId: driver.id,
              paymentDate: targetDate,
              expectedMAD,
              clearedMAD: collected,
              arrearsMAD: newArrears,
              morningBalance: morningBal,
              eveningBalance: eveningBal,
              calculatedDelta: collected,
              notes: `Rapprochement Matin + Soir: Matin ${morningBal} MAD ➔ Soir ${eveningBal} MAD (Encaissé: ${collected} MAD)`,
            },
          });
        }

        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: {
            currentArrearsMAD: newArrears,
            consecutiveUnpaidDays: newUnpaidDays,
            lastPaymentDate: collected > 0 ? new Date() : driver.lastPaymentDate,
          },
        });

        matchedDriversList.push({
          driverId: driver.id,
          fullName: driver.fullName,
          phone: driver.phoneSanitized,
          plateNumber: vehicle?.plate_number || driver.assignedVehicle?.plate_number || "-",
          morningBalance: morningBal,
          eveningBalance: eveningBal,
          collectedAmount: collected,
          expectedMAD,
          status: payStatus,
          isRedFlagged: Boolean(driver.isRedFlagged),
          redFlagReason: driver.redFlagReason || null,
        });
      }

      // Preserve any drivers present in morning file who had no row in evening file
      for (const [driverId, mInfo] of driverMorningMap.entries()) {
        if (!processedDrivers.has(driverId)) {
          const driver = allDrivers.find((d) => d.id === driverId);
          if (!driver) continue;
          const morningBal = mInfo.balance;
          const morningArrears = morningBal < 0 ? Math.abs(morningBal) : 0;
          totalMorningTargetMAD += morningArrears;
          unpaidCount++;

          const existingLedger = driver.payments?.[0] || null;
          if (existingLedger) {
            await prisma.paymentLedger.update({
              where: { id: existingLedger.id },
              data: {
                morningBalance: morningBal,
                arrearsMAD: morningArrears,
              },
            });
          } else {
            await prisma.paymentLedger.create({
              data: {
                driverId: driver.id,
                paymentDate: targetDate,
                expectedMAD: 300,
                clearedMAD: 0,
                arrearsMAD: morningArrears,
                morningBalance: morningBal,
                notes: `Solde initial (matin): ${morningBal} MAD (Non présent au fichier soir)`,
              },
            });
          }

          matchedDriversList.push({
            driverId: driver.id,
            fullName: driver.fullName,
            phone: driver.phoneSanitized,
            plateNumber: mInfo.vehicle?.plate_number || driver.assignedVehicle?.plate_number || "-",
            morningBalance: morningBal,
            eveningBalance: null,
            collectedAmount: 0,
            expectedMAD: 300,
            status: "UNPAID",
            isRedFlagged: Boolean(driver.isRedFlagged),
            redFlagReason: driver.redFlagReason || null,
          });
        }
      }
    } else {
      // ─────────────────────────────────────────────────────────────────────────────
      // CASE 2: SINGLE FILE (Dual Columns in single sheet OR Mode Morning / Evening)
      // ─────────────────────────────────────────────────────────────────────────────
      const hdrs = detectHeaders(singleRows[0]);
      const hasBothColumns = !!(hdrs.morningBalanceKey && hdrs.eveningBalanceKey);
      const effectiveMode = hasBothColumns ? "DUAL_COLUMNS" : reqMode;

      const balanceKey =
        effectiveMode === "EVENING"
          ? (hdrs.eveningBalanceKey || hdrs.genericBalanceKey)
          : effectiveMode === "MORNING"
          ? (hdrs.morningBalanceKey || hdrs.genericBalanceKey)
          : hdrs.genericBalanceKey;

      if (!balanceKey && !hdrs.paymentKey && !hasBothColumns) {
        return NextResponse.json(
          { error: "Colonne 'Balance', 'Solde', 'Versement' ou 'Paiement' introuvable dans le fichier CSV." },
          { status: 400 }
        );
      }

      for (let i = 0; i < singleRows.length; i++) {
        const row = singleRows[i];
        const rawMorningBal = hdrs.morningBalanceKey ? row[hdrs.morningBalanceKey] : undefined;
        const rawEveningBal = hdrs.eveningBalanceKey ? row[hdrs.eveningBalanceKey] : undefined;
        const rawBalance = balanceKey ? row[balanceKey] : undefined;
        const rawPayment = hdrs.paymentKey ? row[hdrs.paymentKey] : undefined;

        let balance = parseBalance(rawBalance) ?? 0;
        const directPayment = parseBalance(rawPayment) !== null ? Math.max(0, parseBalance(rawPayment)!) : 0;

        const { driver, vehicle } = await resolveDriverAndVehicle(row, hdrs);
        if (!driver) {
          unmatchedRows.push({
            rowNumber: i + 2,
            name: hdrs.nameKey ? row[hdrs.nameKey] : "Inconnu",
            phone: hdrs.phoneKey ? row[hdrs.phoneKey] : "-",
            balance,
          });
          continue;
        }

        const rawContract = hdrs.contractKey ? row[hdrs.contractKey]?.trim() : "";
        let contract = (rawContract || driver.contractType || "DAILY").toUpperCase();
        let expectedMAD = 0;
        if (contract === "WEEKLY") {
          if (dayOfWeek === 1) expectedMAD = 1800;
        } else {
          if (dayOfWeek >= 1 && dayOfWeek <= 6) expectedMAD = 300;
        }

        const existingLedger = driver.payments?.[0] || null;

        if (effectiveMode === "DUAL_COLUMNS") {
          // File has both Solde Matin and Solde Soir columns!
          const mBal = parseBalance(rawMorningBal) ?? 0;
          const eBal = parseBalance(rawEveningBal) ?? balance;
          const morningArrears = mBal < 0 ? Math.abs(mBal) : 0;
          totalMorningTargetMAD += morningArrears;

          let calculatedDelta = 0;
          if (mBal <= 0 && eBal >= mBal) calculatedDelta = eBal - mBal;
          else if (mBal > 0 && eBal <= mBal) calculatedDelta = mBal - eBal;

          let collected = directPayment > 0 ? Math.max(directPayment, calculatedDelta) : calculatedDelta;
          collected = Math.max(0, Math.round(collected * 100) / 100);
          totalCollectedToday += collected;

          let payStatus: "PAID" | "PARTIAL" | "UNPAID" = "UNPAID";
          if (collected >= expectedMAD && expectedMAD > 0) {
            payStatus = "PAID";
            paidCount++;
          } else if (collected > 0) {
            payStatus = "PARTIAL";
            partialCount++;
          } else {
            payStatus = "UNPAID";
            unpaidCount++;
          }

          const newArrears = eBal !== 0 ? (eBal < 0 ? Math.abs(eBal) : 0) : Math.max(0, morningArrears - collected);
          const newUnpaidDays = collected >= expectedMAD && expectedMAD > 0 ? 0 : Math.max(1, (driver.consecutiveUnpaidDays || 0) + 1);

          if (existingLedger) {
            await prisma.paymentLedger.update({
              where: { id: existingLedger.id },
              data: {
                morningBalance: mBal,
                eveningBalance: eBal,
                clearedMAD: collected,
                calculatedDelta: collected,
                arrearsMAD: newArrears,
                expectedMAD: expectedMAD || existingLedger.expectedMAD,
                notes: `Rapprochement complet (Colonnes Matin + Soir): Matin ${mBal} MAD ➔ Soir ${eBal} MAD (Encaissé: ${collected} MAD)`,
              },
            });
          } else {
            await prisma.paymentLedger.create({
              data: {
                driverId: driver.id,
                paymentDate: targetDate,
                expectedMAD,
                clearedMAD: collected,
                arrearsMAD: newArrears,
                morningBalance: mBal,
                eveningBalance: eBal,
                calculatedDelta: collected,
                notes: `Rapprochement complet (Colonnes Matin + Soir): Matin ${mBal} MAD ➔ Soir ${eBal} MAD (Encaissé: ${collected} MAD)`,
              },
            });
          }

          await prisma.driverProfile.update({
            where: { id: driver.id },
            data: {
              currentArrearsMAD: newArrears,
              consecutiveUnpaidDays: newUnpaidDays,
              lastPaymentDate: collected > 0 ? new Date() : driver.lastPaymentDate,
            },
          });

          matchedDriversList.push({
            driverId: driver.id,
            fullName: driver.fullName,
            phone: driver.phoneSanitized,
            plateNumber: vehicle?.plate_number || driver.assignedVehicle?.plate_number || "-",
            morningBalance: mBal,
            eveningBalance: eBal,
            collectedAmount: collected,
            expectedMAD,
            status: payStatus,
            isRedFlagged: Boolean(driver.isRedFlagged),
            redFlagReason: driver.redFlagReason || null,
          });
        } else if (effectiveMode === "MORNING") {
          // === MORNING SNAPSHOT ===
          const morningArrears = balance < 0 ? Math.abs(balance) : 0;
          const morningUnpaidDays = morningArrears === 0 ? 0 : Math.max(1, Math.ceil(morningArrears / 300));
          const morningCleared = directPayment > 0 ? directPayment : (existingLedger?.clearedMAD || 0);
          totalMorningTargetMAD += morningArrears;
          if (morningCleared > 0) totalCollectedToday += morningCleared;

          if (existingLedger) {
            await prisma.paymentLedger.update({
              where: { id: existingLedger.id },
              data: {
                morningBalance: balance,
                expectedMAD: expectedMAD || existingLedger.expectedMAD,
                clearedMAD: morningCleared,
                arrearsMAD: morningArrears,
                notes: existingLedger.notes || `Solde initial: ${balance} MAD${morningCleared > 0 ? ` (Versement: ${morningCleared} MAD)` : ""}`,
              },
            });
          } else {
            await prisma.paymentLedger.create({
              data: {
                driverId: driver.id,
                paymentDate: targetDate,
                expectedMAD,
                clearedMAD: morningCleared,
                arrearsMAD: morningArrears,
                morningBalance: balance,
                notes: `Solde initial (matin): ${balance} MAD${morningCleared > 0 ? ` (Versement: ${morningCleared} MAD)` : ""}`,
              },
            });
          }

          await prisma.driverProfile.update({
            where: { id: driver.id },
            data: {
              currentArrearsMAD: morningArrears,
              consecutiveUnpaidDays: morningUnpaidDays,
            },
          });

          matchedDriversList.push({
            driverId: driver.id,
            fullName: driver.fullName,
            phone: driver.phoneSanitized,
            plateNumber: vehicle?.plate_number || driver.assignedVehicle?.plate_number || "-",
            morningBalance: balance,
            eveningBalance: existingLedger?.eveningBalance ?? null,
            collectedAmount: morningCleared,
            expectedMAD,
            status: morningCleared > 0 ? (morningCleared >= expectedMAD ? "PAID" : "PARTIAL") : "MORNING_SET",
            isRedFlagged: Boolean(driver.isRedFlagged),
            redFlagReason: driver.redFlagReason || null,
          });
        } else {
          // === EVENING SNAPSHOT & RECONCILIATION ===
          const morningBal =
            existingLedger?.morningBalance !== undefined && existingLedger?.morningBalance !== null
              ? existingLedger.morningBalance
              : -driver.currentArrearsMAD;

          let calculatedDelta = 0;
          if (morningBal <= 0 && balance >= morningBal) {
            calculatedDelta = balance - morningBal;
          } else if (morningBal > 0 && balance <= morningBal) {
            calculatedDelta = morningBal - balance;
          }

          let collected = directPayment > 0 ? Math.max(directPayment, calculatedDelta) : calculatedDelta;
          collected = Math.max(0, Math.round(collected * 100) / 100);
          totalCollectedToday += collected;

          let payStatus: "PAID" | "PARTIAL" | "UNPAID" = "UNPAID";
          if (collected >= expectedMAD && expectedMAD > 0) {
            payStatus = "PAID";
            paidCount++;
          } else if (collected > 0) {
            payStatus = "PARTIAL";
            partialCount++;
          } else {
            payStatus = "UNPAID";
            unpaidCount++;
          }

          const newArrears = balance !== 0 ? (balance < 0 ? Math.abs(balance) : 0) : Math.max(0, (driver.currentArrearsMAD || 0) - collected);
          const newUnpaidDays = collected >= expectedMAD && expectedMAD > 0 ? 0 : Math.max(1, (driver.consecutiveUnpaidDays || 0) + 1);

          if (existingLedger) {
            await prisma.paymentLedger.update({
              where: { id: existingLedger.id },
              data: {
                eveningBalance: balance,
                calculatedDelta: collected,
                clearedMAD: collected,
                arrearsMAD: newArrears,
                notes: `Rapprochement soir: Matin ${morningBal} MAD ➔ Soir ${balance} MAD (Encaissé: ${collected} MAD)`,
              },
            });
          } else {
            await prisma.paymentLedger.create({
              data: {
                driverId: driver.id,
                paymentDate: targetDate,
                expectedMAD,
                clearedMAD: collected,
                arrearsMAD: newArrears,
                morningBalance: morningBal,
                eveningBalance: balance,
                calculatedDelta: collected,
                notes: `Rapprochement soir: Matin ${morningBal} MAD ➔ Soir ${balance} MAD (Encaissé: ${collected} MAD)`,
              },
            });
          }

          await prisma.driverProfile.update({
            where: { id: driver.id },
            data: {
              currentArrearsMAD: newArrears,
              consecutiveUnpaidDays: newUnpaidDays,
              lastPaymentDate: collected > 0 ? new Date() : driver.lastPaymentDate,
            },
          });

          matchedDriversList.push({
            driverId: driver.id,
            fullName: driver.fullName,
            phone: driver.phoneSanitized,
            plateNumber: vehicle?.plate_number || driver.assignedVehicle?.plate_number || "-",
            morningBalance: morningBal,
            eveningBalance: balance,
            collectedAmount: collected,
            expectedMAD,
            status: payStatus,
            isRedFlagged: Boolean(driver.isRedFlagged),
            redFlagReason: driver.redFlagReason || null,
          });
        }
      }
    }

    // Touch sync state so all active sessions & dashboard instantly refresh collections data
    await flushDatabaseSync();
    await touchSyncState("collections");
    invalidateDriverCache();

    return NextResponse.json({
      success: true,
      mode: isDualFiles ? "DUAL" : reqMode,
      date: dateParam,
      summary: {
        totalRows: isDualFiles ? eveningRows.length : singleRows.length,
        matchedCount: matchedDriversList.length,
        unmatchedCount: unmatchedRows.length,
        totalCollectedTodayMAD: totalCollectedToday,
        totalMorningTargetMAD,
        newDriversCreated,
        newVehiclesCreated,
        vehiclesReassignedCount: reassignedVehicles.length,
        reassignedVehicles,
        paidCount,
        partialCount,
        unpaidCount,
      },
      matchedDrivers: matchedDriversList,
      unmatchedRows,
    });
  } catch (error: any) {
    console.error("POST /api/collections/upload-balance error:", error);
    return NextResponse.json(
      { error: error?.message || "Erreur lors du traitement du fichier de soldes." },
      { status: 500 }
    );
  }
}
