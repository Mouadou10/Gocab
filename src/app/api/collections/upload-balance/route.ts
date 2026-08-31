import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

/**
 * Normalizes phone numbers to comparable digits-only format.
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // If starts with 212, or local 06/07
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
 * Parses numeric balance from string (e.g. "-3000", "-2,800.00 MAD", "1500").
 */
function parseBalance(val: any): number | null {
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (!val || typeof val !== "string") return null;
  const cleaned = val.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mode = ((formData.get("mode") as string) || "MORNING").toUpperCase(); // "MORNING" or "EVENING"
    const dateParam = (formData.get("date") as string) || new Date().toISOString().split("T")[0];

    if (!file) {
      return NextResponse.json({ error: "Veuillez fournir un fichier CSV." }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: "Erreur de lecture du fichier CSV." }, { status: 400 });
    }

    const rows = parsed.data;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Le fichier CSV est vide." }, { status: 400 });
    }

    // Determine target business date
    const targetDate = new Date(`${dateParam}T12:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay();
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Fetch all active drivers from database
    const allDrivers = await prisma.driverProfile.findMany({
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
    });

    // Build fast lookup maps
    const phoneMap = new Map<string, typeof allDrivers[0]>();
    const nameMap = new Map<string, typeof allDrivers[0]>();
    const cinMap = new Map<string, typeof allDrivers[0]>();

    for (const d of allDrivers) {
      const pNorm = normalizePhone(d.phoneSanitized);
      if (pNorm) phoneMap.set(pNorm, d);

      const nNorm = normalizeName(d.fullName);
      if (nNorm) nameMap.set(nNorm, d);

      if (d.cinNumber) cinMap.set(d.cinNumber.toUpperCase().trim(), d);
    }

    // Detect column headers dynamically
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    const nameKey = keys.find((k) =>
      /^(name|driver\s*name|nom|chauffeur|full\s*name)$/i.test(k.trim())
    ) || keys.find((k) => /name|nom/i.test(k));

    const phoneKey = keys.find((k) =>
      /^(phone|phone\s*number|telephone|tel|num|mobile)$/i.test(k.trim())
    ) || keys.find((k) => /phone|tel/i.test(k));

    const balanceKey = keys.find((k) =>
      /^(balance|solde|current\s*balance|montant|total\s*balance)$/i.test(k.trim())
    ) || keys.find((k) => /balance|solde/i.test(k));

    const cinKey = keys.find((k) =>
      /^(id\s*number|cin|cnie|piece\s*identite)$/i.test(k.trim())
    ) || keys.find((k) => /id\s*number|cin/i.test(k));

    if (!balanceKey) {
      return NextResponse.json(
        { error: "Colonne 'Balance' ou 'Solde' introuvable dans le fichier CSV." },
        { status: 400 }
      );
    }

    const matchedDriversList: any[] = [];
    const unmatchedRows: any[] = [];
    let totalCollectedToday = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawName = nameKey ? row[nameKey]?.trim() : "";
      const rawPhone = phoneKey ? row[phoneKey]?.trim() : "";
      const rawCin = cinKey ? row[cinKey]?.trim() : "";
      const rawBalance = row[balanceKey];

      const balance = parseBalance(rawBalance);
      if (balance === null) continue;

      // Try matching by phone, CIN, or name
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

        // Fallback: partial word matching
        if (!driver) {
          const parts = nNorm.split(" ").filter((p) => p.length >= 3);
          for (const d of allDrivers) {
            const dNorm = normalizeName(d.fullName);
            if (parts.length >= 2 && parts.every((p) => dNorm.includes(p))) {
              driver = d;
              break;
            }
          }
        }
      }

      if (!driver) {
        unmatchedRows.push({
          rowNumber: i + 2,
          name: rawName || "Inconnu",
          phone: rawPhone || "-",
          balance,
        });
        continue;
      }

      // Expected amount for this driver today
      const contract = (driver.contractType || "DAILY").toUpperCase();
      let expectedMAD = 0;
      if (contract === "WEEKLY") {
        if (dayOfWeek === 1) expectedMAD = 1800;
      } else {
        if (dayOfWeek >= 1 && dayOfWeek <= 6) expectedMAD = 300;
      }

      const existingLedger = driver.payments[0] || null;

      if (mode === "MORNING") {
        // === MORNING SNAPSHOT ===
        // Stores starting balance for the day
        if (existingLedger) {
          await prisma.paymentLedger.update({
            where: { id: existingLedger.id },
            data: {
              morningBalance: balance,
              expectedMAD: expectedMAD || existingLedger.expectedMAD,
              notes: existingLedger.notes || `Solde initial: ${balance} MAD`,
            },
          });
        } else {
          await prisma.paymentLedger.create({
            data: {
              driverId: driver.id,
              paymentDate: targetDate,
              expectedMAD,
              clearedMAD: 0,
              arrearsMAD: Math.abs(balance),
              morningBalance: balance,
              notes: `Solde initial (matin): ${balance} MAD`,
            },
          });
        }

        // Update driver's current arrears and calculate unpaid days from balance
        const morningArrears = Math.abs(balance);
        const morningUnpaidDays = balance === 0 ? 0 : Math.max(1, Math.ceil(morningArrears / 300));

        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: {
            currentArrearsMAD: morningArrears,
            consecutiveUnpaidDays: morningUnpaidDays,
            defaultStage: morningArrears >= 1500 ? "DAY_3_BLOCK" : morningArrears >= 600 ? "DAY_2_ACTION" : "NOMINAL",
          },
        });

        matchedDriversList.push({
          driverId: driver.id,
          fullName: driver.fullName,
          phone: driver.phoneSanitized,
          plateNumber: driver.assignedVehicle?.plate_number || "-",
          morningBalance: balance,
          eveningBalance: null,
          collectedAmount: 0,
          status: "MORNING_SET",
        });
      } else {
        // === EVENING SNAPSHOT & RECONCILIATION ===
        const morningBal =
          existingLedger?.morningBalance !== undefined && existingLedger?.morningBalance !== null
            ? existingLedger.morningBalance
            : -driver.currentArrearsMAD; // Fallback to current arrears if morning was not imported

        // Calculate amount collected:
        // When balance is negative (e.g. -3000 to -2700), collected = (-2700) - (-3000) = +300
        // When balance is positive debt (3000 to 2700), collected = 3000 - 2700 = +300
        let collected = 0;
        if (morningBal <= 0 && balance >= morningBal) {
          collected = balance - morningBal;
        } else if (morningBal > 0 && balance <= morningBal) {
          collected = morningBal - balance;
        } else if (morningBal <= 0 && balance < morningBal) {
          // Debt increased (no payment made, or additional penalty)
          collected = 0;
        }

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

        // Calculate new arrears and consecutive unpaid days
        const newArrears = Math.abs(balance);
        let newUnpaidDays = driver.consecutiveUnpaidDays || 0;
        if (collected >= expectedMAD && expectedMAD > 0) {
          newUnpaidDays = 0;
        } else if (collected < expectedMAD && expectedMAD > 0) {
          newUnpaidDays = Math.max(1, newUnpaidDays + 1);
        }

        // Upsert PaymentLedger with evening balance & cleared amount
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

        // Update DriverProfile
        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: {
            currentArrearsMAD: newArrears,
            consecutiveUnpaidDays: newUnpaidDays,
            lastPaymentDate: collected > 0 ? new Date() : driver.lastPaymentDate,
            defaultStage: newArrears >= 1500 ? "DAY_3_BLOCK" : newArrears >= 600 ? "DAY_2_ACTION" : "NOMINAL",
          },
        });

        matchedDriversList.push({
          driverId: driver.id,
          fullName: driver.fullName,
          phone: driver.phoneSanitized,
          plateNumber: driver.assignedVehicle?.plate_number || "-",
          morningBalance: morningBal,
          eveningBalance: balance,
          collectedAmount: collected,
          expectedMAD,
          status: payStatus,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      date: dateParam,
      summary: {
        totalRows: rows.length,
        matchedCount: matchedDriversList.length,
        unmatchedCount: unmatchedRows.length,
        totalCollectedTodayMAD: totalCollectedToday,
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
