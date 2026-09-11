import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import Papa from "papaparse";

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
 */
function normalizePlate(plate: string): string {
  if (!plate) return "";
  return plate
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
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

    // If Monday (dayOfWeek === 1), fetch previous Friday through Sunday ledgers to compare balances
    const fridayDate = new Date(targetDate);
    fridayDate.setUTCDate(fridayDate.getUTCDate() - 3); // 3 days before Monday is Friday
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
      if (pNorm) plateMap.set(pNorm, v);
    }

    // Detect column headers dynamically from the CSV
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    const nameKey =
      keys.find((k) => /^(name|driver\s*name|nom|chauffeur|full\s*name)$/i.test(k.trim())) ||
      keys.find((k) => /name|nom/i.test(k));

    const phoneKey =
      keys.find((k) => /^(phone|phone\s*number|telephone|tel|num|mobile)$/i.test(k.trim())) ||
      keys.find((k) => /phone|tel/i.test(k));

    const balanceKey =
      keys.find((k) => /^(balance|solde|current\s*balance|montant|total\s*balance|impayes|arrears)$/i.test(k.trim())) ||
      keys.find((k) => /balance|solde|impaye/i.test(k));

    const cinKey =
      keys.find((k) => /^(id\s*number|cin|cnie|piece\s*identite)$/i.test(k.trim())) ||
      keys.find((k) => /id\s*number|cin/i.test(k));

    const plateKey =
      keys.find((k) => /^(plate|plate\s*number|immatriculation|matricule|vehicule|vehicle|car)$/i.test(k.trim())) ||
      keys.find((k) => /plate|immat|matricule/i.test(k));

    const makeModelKey =
      keys.find((k) => /^(make|model|make\s*model|marque|modele|car\s*model)$/i.test(k.trim())) ||
      keys.find((k) => /model|marque/i.test(k));

    const statusKey =
      keys.find((k) => /^(status|statut|etat|vehicle\s*status|driver\s*status)$/i.test(k.trim())) ||
      keys.find((k) => /status|statut/i.test(k));

    const contractKey =
      keys.find((k) => /^(contract|contrat|contract\s*type|type\s*contrat)$/i.test(k.trim())) ||
      keys.find((k) => /contract|contrat/i.test(k));

    const cityKey =
      keys.find((k) => /^(city|ville|hub|region)$/i.test(k.trim())) ||
      keys.find((k) => /city|ville|hub/i.test(k));

    if (!balanceKey) {
      return NextResponse.json(
        { error: "Colonne 'Balance' ou 'Solde' introuvable dans le fichier CSV." },
        { status: 400 }
      );
    }

    const matchedDriversList: any[] = [];
    const unmatchedRows: any[] = [];
    const processedDriverIds = new Set<string>();
    let totalCollectedToday = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let newDriversCreated = 0;
    let newVehiclesCreated = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawName = nameKey ? row[nameKey]?.trim() : "";
      const rawPhone = phoneKey ? row[phoneKey]?.trim() : "";
      const rawCin = cinKey ? row[cinKey]?.trim() : "";
      const rawPlate = plateKey ? row[plateKey]?.trim() : "";
      const rawMakeModel = makeModelKey ? row[makeModelKey]?.trim() : "";
      const rawStatus = statusKey ? row[statusKey]?.trim() : "";
      const rawContract = contractKey ? row[contractKey]?.trim() : "";
      const rawCity = cityKey ? row[cityKey]?.trim() : "";
      const rawBalance = row[balanceKey];

      const balance = parseBalance(rawBalance);
      if (balance === null) continue;

      // ── Step 1: Resolve or Create Vehicle from Plate ───────────────────
      let vehicle = null;
      if (rawPlate) {
        const normPlate = normalizePlate(rawPlate);
        if (normPlate) {
          vehicle = plateMap.get(normPlate);
          if (!vehicle) {
            try {
              vehicle = await prisma.vehicle.create({
                data: {
                  plate_number: normPlate,
                  make_model: rawMakeModel || "Dacia Logan 1.5 dCi",
                  year: 2023,
                  hub_city: rawCity || "Casablanca",
                  status: rawStatus || "Actif",
                  assigned_driver_name: rawName || null,
                  assigned_driver_phone: rawPhone || null,
                },
              });
              plateMap.set(normPlate, vehicle);
              newVehiclesCreated++;
            } catch (e) {
              vehicle = plateMap.get(normPlate) || null;
            }
          } else if (rawStatus && vehicle.status !== rawStatus) {
            // Update vehicle status if explicitly specified in CSV
            await prisma.vehicle.update({
              where: { id: vehicle.id },
              data: { status: rawStatus },
            }).catch(() => {});
          }
        }
      }

      // ── Step 2: Resolve or Create Driver ───────────────────────────────
      let driver: typeof allDrivers[0] | undefined;

      if (rawPhone) {
        const pNorm = normalizePhone(rawPhone);
        driver = phoneMap.get(pNorm);
      }

      if (!driver && rawCin) {
        driver = cinMap.get(rawCin.toUpperCase().trim());
      }

      if (!driver && vehicle?.id) {
        driver = allDrivers.find((d) => d.assignedVehicleId === vehicle!.id);
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

      // If driver is not found in DB, auto-enroll driver from CSV (SSOT)
      if (!driver) {
        const pDigits = normalizePhone(rawPhone);
        const phoneFormatted = pDigits
          ? `+212${pDigits}`
          : `+212600${Math.floor(100000 + Math.random() * 900000)}`;
        const cinFormatted = rawCin
          ? rawCin.toUpperCase().trim()
          : `CIN-${Math.floor(100000 + Math.random() * 900000)}`;

        try {
          const newDriver = await prisma.driverProfile.create({
            data: {
              fullName: rawName || `Chauffeur ${rawPlate || "CSV"}`,
              phoneSanitized: phoneFormatted,
              cinNumber: cinFormatted,
              contractType: rawContract?.toUpperCase() === "WEEKLY" ? "WEEKLY" : "DAILY",
              assignedVehicleId: vehicle?.id || null,
              currentArrearsMAD: balance < 0 ? Math.abs(balance) : 0,
              consecutiveUnpaidDays: balance < 0 ? Math.max(1, Math.ceil(Math.abs(balance) / 300)) : 0,
              defaultStage:
                balance < -1500 ? "DAY_3_BLOCK" : balance < -600 ? "DAY_2_ACTION" : "NOMINAL",
            },
            include: {
              assignedVehicle: true,
              payments: true,
            },
          });

          driver = newDriver as any;
          allDrivers.push(newDriver as any);
          if (pDigits) phoneMap.set(pDigits, newDriver as any);
          if (rawName) nameMap.set(normalizeName(rawName), newDriver as any);
          cinMap.set(cinFormatted, newDriver as any);
          newDriversCreated++;
        } catch (err) {
          console.warn("Auto-create driver failed from CSV row:", err);
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

      processedDriverIds.add(driver.id);

      // Link vehicle if not yet linked
      if (vehicle && driver.assignedVehicleId !== vehicle.id) {
        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: { assignedVehicleId: vehicle.id },
        }).catch(() => {});
        (driver as any).assignedVehicle = vehicle;
      }

      // Contract detection & expected amount
      let contract = (rawContract || driver.contractType || "DAILY").toUpperCase();

      if (dayOfWeek === 1) {
        // MONDAY CONTRACT AUTO-DETECTION (WEEKLY 1,800 DH vs DAILY 300 DH)
        // Retrieve driver's Friday (or most recent prior) balance
        const priorEntry = priorLedgerMap.get(driver.id);
        let fridayDebt = 0;
        if (priorEntry) {
          if (priorEntry.eveningBalance !== null && priorEntry.eveningBalance !== undefined) {
            fridayDebt = priorEntry.eveningBalance < 0 ? Math.abs(priorEntry.eveningBalance) : 0;
          } else if (priorEntry.morningBalance !== null && priorEntry.morningBalance !== undefined) {
            fridayDebt = priorEntry.morningBalance < 0 ? Math.abs(priorEntry.morningBalance) : 0;
          } else {
            fridayDebt = priorEntry.arrearsMAD || 0;
          }
        } else {
          fridayDebt = driver.currentArrearsMAD || 0;
        }

        const mondayDebt = balance < 0 ? Math.abs(balance) : 0;
        const deltaDebt = mondayDebt - fridayDebt;

        // Detection rules:
        // 1. If added debt on Monday is ~1800 DH -> WEEKLY
        // 2. If added debt is ~300 DH or ~600 DH (Saturday + Monday) -> DAILY
        // 3. If fridayDebt was 0 and mondayDebt is ~1800 DH -> WEEKLY
        // 4. If fridayDebt was 0 and mondayDebt is ~300 or ~600 DH -> DAILY
        // 5. Special Edge Case: If mondayDebt is 1800, but fridayDebt > 0 (e.g. 1200 DH) and deltaDebt != 1800
        //    (e.g. 1200 remaining + 300 Sat + 300 Mon = 1800 DH), this is DAILY, not weekly!
        if (Math.abs(deltaDebt - 1800) <= 50) {
          contract = "WEEKLY";
        } else if (Math.abs(deltaDebt - 300) <= 50 || Math.abs(deltaDebt - 600) <= 50) {
          contract = "DAILY";
        } else if (fridayDebt === 0 && Math.abs(mondayDebt - 1800) <= 50) {
          contract = "WEEKLY";
        } else if (fridayDebt === 0 && (Math.abs(mondayDebt - 300) <= 50 || Math.abs(mondayDebt - 600) <= 50)) {
          contract = "DAILY";
        } else if (Math.abs(mondayDebt - 1800) <= 50 && fridayDebt > 0 && Math.abs(deltaDebt - 1800) > 100) {
          contract = "DAILY";
        }

        // Persist detected contract type if changed
        if (contract !== driver.contractType) {
          await prisma.driverProfile
            .update({
              where: { id: driver.id },
              data: { contractType: contract },
            })
            .catch(() => {});
          driver.contractType = contract;
        }
      }

      let expectedMAD = 0;
      if (contract === "WEEKLY") {
        if (dayOfWeek === 1) expectedMAD = 1800;
      } else {
        if (dayOfWeek >= 1 && dayOfWeek <= 6) expectedMAD = 300;
      }

      const existingLedger = driver.payments?.[0] || null;

      if (mode === "MORNING") {
        // === MORNING SNAPSHOT ===
        // Negative balance represents debt. Positive balance represents credit/advance (0 debt).
        const morningArrears = balance < 0 ? Math.abs(balance) : 0;
        const morningUnpaidDays = morningArrears === 0 ? 0 : Math.max(1, Math.ceil(morningArrears / 300));

        if (existingLedger) {
          await prisma.paymentLedger.update({
            where: { id: existingLedger.id },
            data: {
              morningBalance: balance,
              expectedMAD: expectedMAD || existingLedger.expectedMAD,
              arrearsMAD: morningArrears,
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
              arrearsMAD: morningArrears,
              morningBalance: balance,
              notes: `Solde initial (matin): ${balance} MAD`,
            },
          });
        }

        // Update driver's current arrears strictly according to CSV
        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: {
            currentArrearsMAD: morningArrears,
            consecutiveUnpaidDays: morningUnpaidDays,
            defaultStage:
              morningArrears >= 1500
                ? "DAY_3_BLOCK"
                : morningArrears >= 600
                ? "DAY_2_ACTION"
                : "NOMINAL",
          },
        });

        matchedDriversList.push({
          driverId: driver.id,
          fullName: driver.fullName,
          phone: driver.phoneSanitized,
          plateNumber: vehicle?.plate_number || driver.assignedVehicle?.plate_number || "-",
          morningBalance: balance,
          eveningBalance: null,
          collectedAmount: 0,
          expectedMAD,
          status: "MORNING_SET",
        });
      } else {
        // === EVENING SNAPSHOT & RECONCILIATION ===
        const morningBal =
          existingLedger?.morningBalance !== undefined && existingLedger?.morningBalance !== null
            ? existingLedger.morningBalance
            : -driver.currentArrearsMAD;

        let collected = 0;
        if (morningBal <= 0 && balance >= morningBal) {
          collected = balance - morningBal;
        } else if (morningBal > 0 && balance <= morningBal) {
          collected = morningBal - balance;
        } else if (morningBal <= 0 && balance < morningBal) {
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

        const newArrears = balance < 0 ? Math.abs(balance) : 0;
        let newUnpaidDays = driver.consecutiveUnpaidDays || 0;
        if (collected >= expectedMAD && expectedMAD > 0) {
          newUnpaidDays = 0;
        } else if (collected < expectedMAD && expectedMAD > 0) {
          newUnpaidDays = Math.max(1, newUnpaidDays + 1);
        }

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
            defaultStage:
              newArrears >= 1500
                ? "DAY_3_BLOCK"
                : newArrears >= 600
                ? "DAY_2_ACTION"
                : "NOMINAL",
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
        });
      }
    }

    // ── SSOT FLEET DEBT ALIGNMENT ─────────────────────────────────────────
    // In MORNING mode, the CSV is the Single Source of Truth for the fleet.
    // Any driver in the database not included in the CSV is reconciled to 0 debt.
    if (mode === "MORNING") {
      const nonCsvDrivers = allDrivers.filter((d) => !processedDriverIds.has(d.id));
      if (nonCsvDrivers.length > 0) {
        await prisma.driverProfile.updateMany({
          where: { id: { in: nonCsvDrivers.map((d) => d.id) } },
          data: {
            currentArrearsMAD: 0,
            consecutiveUnpaidDays: 0,
            defaultStage: "NOMINAL",
          },
        });
      }
    }

    // Touch sync state so all active sessions & dashboard instantly refresh collections data
    await touchSyncState("collections");

    return NextResponse.json({
      success: true,
      mode,
      date: dateParam,
      summary: {
        totalRows: rows.length,
        matchedCount: matchedDriversList.length,
        unmatchedCount: unmatchedRows.length,
        totalCollectedTodayMAD: totalCollectedToday,
        newDriversCreated,
        newVehiclesCreated,
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
