/**
 * Bulk Driver CSV Upload API — POST /api/upload-drivers
 *
 * Parses CSV/Excel containing drivers (handles GoCab spreadsheet with Phone Number, Name, Gender, Balance, ID Number, Vehicles, Comment),
 * auto-sanitizes Moroccan phone numbers, computes debt/arrears strictly from negative balance (positive = prepaid credit = 0 debt),
 * performs multi-pattern matching to vehicles by immatriculation / WW variations,
 * syncs today's morning PaymentLedger balance when Balance is provided so Fleet Performance KPIs update immediately,
 * and bulk-inserts/upserts DriverProfile records.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, flushDatabaseSync } from "@/lib/prisma";
import { parseSpreadsheetFile } from "@/lib/spreadsheet";
import { reconcileDriverVehicleAssignments } from "@/lib/services/driverVehicleReconciliation";
import { invalidateDriverCache } from "@/lib/driverCache";
import { touchSyncState } from "@/lib/sync";
import { requireAuth } from "@/lib/api-auth";

/** Standard Moroccan phone sanitization (+212XXXXXXXXX) */
function sanitizePhone(raw: string): string {
  let cleaned = raw.replace(/[\s\-\.\(\)]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("212")) cleaned = cleaned.slice(3);
  cleaned = cleaned.replace(/^0+/, "");
  return `+212${cleaned}`;
}

/** Normalize plate number for fuzzy matching (strips dashes, spaces, slashes, pipes) */
function normalizePlate(raw: string): string {
  if (!raw) return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parseNumericBalance(val: string | undefined): number | null {
  if (!val) return null;
  const s = val.trim();
  if (!s) return null;
  const isParenNegative = /^\(.*\)$/.test(s);
  const hasMinus = s.includes("-") || isParenNegative;
  let numStr = s.replace(/[^0-9.,]/g, "");
  if (!numStr) return null;
  if (numStr.includes(",") && numStr.includes(".")) {
    if (numStr.lastIndexOf(",") > numStr.lastIndexOf(".")) {
      numStr = numStr.replace(/\./g, "").replace(",", ".");
    } else {
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

const NON_WORKING_IMMOBILIZED_STATUSES = new Set([
  "police_immobilization",
  "impounded",
  "impounded by police",
  "In garage",
  "maintenance",
  "Accident",
  "missing_document",
  "missing_key",
  "Blocked",
]);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(["ADMIN", "OPS_MANAGER", "FLEET_PERF_MANAGER", "ONBOARDING_SPECIALIST"]);
    if ("error" in authResult) {
      return authResult.error;
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier CSV ou Excel fourni" }, { status: 400 });
    }

    const { rows: rawRows } = await parseSpreadsheetFile(file);
    const data = rawRows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[k.trim().toLowerCase().replace(/^["']|["']$/g, "")] = v;
      }
      return normalized;
    });

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Le fichier est vide ou illisible" }, { status: 400 });
    }

    const getField = (row: Record<string, string>, aliases: string[]): string | undefined => {
      for (const alias of aliases) {
        const val = row[alias.toLowerCase()];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          return String(val).trim();
        }
      }
      return undefined;
    };

    let total_rows = 0;
    let inserted = 0;
    let updated = 0;
    let skipped_invalid = 0;
    let linked_vehicles = 0;

    // Today's date boundaries for syncing morning PaymentLedger when Balance is present
    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = new Date(`${todayStr}T12:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay();
    const startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);

    // Fetch all vehicles and today's ledgers
    const [allVehicles, initialAssignedVehicles, existingTodayLedgers] = await Promise.all([
      prisma.vehicle.findMany({ where: { is_archived: false } }),
      prisma.vehicle.findMany({
        where: {
          is_archived: false,
          assigned_driver_name: { not: null },
        },
        include: { driverProfile: true },
      }),
      prisma.paymentLedger.findMany({
        where: {
          paymentDate: { gte: startOfDay, lte: endOfDay },
        },
      }),
    ]);

    const todayLedgerByDriverId = new Map<string, (typeof existingTodayLedgers)[0]>();
    for (const pl of existingTodayLedgers) {
      todayLedgerByDriverId.set(pl.driverId, pl);
    }

    const findMatchingVehicle = (rawPlate: string) => {
      if (!rawPlate) return null;
      const targetNorm = normalizePlate(rawPlate);
      if (!targetNorm) return null;

      // 1. Direct normalized match on plate_number
      for (const v of allVehicles) {
        if (normalizePlate(v.plate_number) === targetNorm) return v;
      }

      // 2. WW prefix vs suffix match (e.g. 028101WW vs WW028101)
      const targetDigits = targetNorm.replace(/WW/g, "");
      if (targetDigits.length >= 4 && targetNorm.includes("WW")) {
        for (const v of allVehicles) {
          const vNorm = normalizePlate(v.plate_number);
          if (vNorm.includes("WW") && vNorm.replace(/WW/g, "") === targetDigits) return v;
        }
      }

      // 3. Search in vehicle notes (e.g. "Ancien N°: 860533-WW" or "Enreg:")
      for (const v of allVehicles) {
        if (v.notes && normalizePlate(v.notes).includes(targetNorm)) {
          return v;
        }
      }

      // 4. VIN match if provided
      for (const v of allVehicles) {
        if (v.vin && normalizePlate(v.vin) === targetNorm) {
          return v;
        }
      }

      return null;
    };

    const csvVehicleAssignments: Record<string, { driverName: string; driverPhone: string; driverId: string }> = {};
    const csvDriverIds = new Set<string>();
    let churned_drivers = 0;

    for (const row of data) {
      total_rows++;

      const fullName = getField(row, [
        "name", "full name", "fullname", "nom complet", "nom", "driver", "chauffeur", "conducteur"
      ]);
      const rawPhone = getField(row, [
        "phone number", "phone", "telephone", "téléphone", "mobile", "tel", "numero", "numéro"
      ]);

      if (!fullName) {
        skipped_invalid++;
        continue;
      }

      const phoneSanitized = rawPhone
        ? sanitizePhone(rawPhone)
        : `+212600${Math.floor(100000 + Math.random() * 900000)}`;

      const rawCin = getField(row, [
        "id number", "cin", "cnie", "id", "national id", "carte nationale", "n° cin", "id num"
      ]);
      const cinNumber = (rawCin ? rawCin.replace(/\s+/g, "") : `CIN-${phoneSanitized.slice(-6)}`).toUpperCase();

      const rawContract = getField(row, ["type contrat", "contrat", "contract", "type", "contract type", "formule"]);
      let contractType = "DAILY";
      if (rawContract) {
        const norm = rawContract.toLowerCase();
        if (norm.includes("week") || norm.includes("hebdo") || norm.includes("1800") || norm.includes("lundi")) {
          contractType = "WEEKLY";
        }
      }

      // Parse Balance vs Explicit Arrears:
      // In GoCab Yango exports, "Balance" is negative for debt (-2800 => 2800 MAD arrears) and positive for credit (+1800 => 0 MAD arrears).
      // Only if the column is explicitly named "Impayes" / "Arrears" / "Dette" is a positive number treated as debt.
      const rawBalanceCol = getField(row, ["balance", "solde"]);
      const rawExplicitArrearsCol = getField(row, ["impayes mad", "impayes", "impayés", "arrears", "dette"]);

      let parsedBalance: number | null = null;
      let currentArrearsMAD = 0.0;

      if (rawBalanceCol !== undefined) {
        parsedBalance = parseNumericBalance(rawBalanceCol);
        if (parsedBalance !== null) {
          currentArrearsMAD = parsedBalance < 0 ? Math.abs(parsedBalance) : 0.0;
        }
      } else if (rawExplicitArrearsCol !== undefined) {
        const parsedArr = parseNumericBalance(rawExplicitArrearsCol);
        if (parsedArr !== null) {
          currentArrearsMAD = Math.abs(parsedArr);
          parsedBalance = -currentArrearsMAD;
        }
      }

      const explicitStage = getField(row, ["stage", "statut", "default stage", "recouvrement"]);
      let defaultStage = explicitStage || "NOMINAL";
      if (!explicitStage) {
        if (currentArrearsMAD >= 1500) defaultStage = "DAY_3_BLOCK";
        else if (currentArrearsMAD >= 600) defaultStage = "DAY_2_ACTION";
        else if (currentArrearsMAD > 0) defaultStage = "DAY_1_WARNING";
        else defaultStage = "NOMINAL";
      }

      const unpaidDays = currentArrearsMAD === 0 ? 0 : Math.max(1, Math.ceil(currentArrearsMAD / 300));

      const rawPlate = getField(row, [
        "vehicles", "vehicle", "immatriculation", "immatriculatio", "plate", "matricule", "vehicule", "vehicules", "immat", "plate number", "registration", "old number"
      ]);

      let assignedVehicleId: string | null = null;
      const matchedVehicle = rawPlate ? findMatchingVehicle(rawPlate) : null;
      if (matchedVehicle) {
        assignedVehicleId = matchedVehicle.id;
      }

      const existing = await prisma.driverProfile.findFirst({
        where: {
          OR: [
            rawPhone ? { phoneSanitized } : null,
            rawCin ? { cinNumber } : null,
            { fullName },
          ].filter(Boolean) as any,
        },
      });

      let driverRecord;

      if (!existing) {
        if (assignedVehicleId) {
          await prisma.driverProfile.updateMany({
            where: { assignedVehicleId },
            data: { assignedVehicleId: null },
          });
        }

        driverRecord = await prisma.driverProfile.create({
          data: {
            fullName,
            phoneSanitized,
            cinNumber,
            age: 28,
            licenseSeniority: 3,
            contractType,
            currentArrearsMAD,
            defaultStage,
            consecutiveUnpaidDays: unpaidDays,
            isKycVerified: true,
            monthlyTripCount: 0,
            assignedVehicleId,
            is_archived: false,
          },
        });

        if (assignedVehicleId) {
          await prisma.vehicle.update({
            where: { id: assignedVehicleId },
            data: {
              status: "Actif",
              assigned_driver_name: driverRecord.fullName,
              assigned_driver_phone: driverRecord.phoneSanitized,
            },
          });
          linked_vehicles++;
        }
        inserted++;
      } else {
        const finalVehicleId = assignedVehicleId || existing.assignedVehicleId;

        if (assignedVehicleId && existing.assignedVehicleId && existing.assignedVehicleId !== assignedVehicleId) {
          await prisma.vehicle.update({
            where: { id: existing.assignedVehicleId },
            data: {
              assigned_driver_name: null,
              assigned_driver_phone: null,
              historical_driver_name: existing.fullName,
              historical_driver_phone: existing.phoneSanitized,
            },
          }).catch(() => {});
        }

        if (finalVehicleId) {
          await prisma.driverProfile.updateMany({
            where: { assignedVehicleId: finalVehicleId, id: { not: existing.id } },
            data: { assignedVehicleId: null },
          });
        }

        driverRecord = await prisma.driverProfile.update({
          where: { id: existing.id },
          data: {
            fullName,
            phoneSanitized: rawPhone ? phoneSanitized : existing.phoneSanitized,
            cinNumber: rawCin ? cinNumber : existing.cinNumber,
            contractType: rawContract ? contractType : existing.contractType,
            currentArrearsMAD: parsedBalance !== null ? currentArrearsMAD : existing.currentArrearsMAD,
            consecutiveUnpaidDays: parsedBalance !== null ? unpaidDays : existing.consecutiveUnpaidDays,
            defaultStage,
            assignedVehicleId: finalVehicleId,
            is_archived: false,
          },
        });

        if (finalVehicleId) {
          await prisma.vehicle.update({
            where: { id: finalVehicleId },
            data: {
              status: "Actif",
              assigned_driver_name: driverRecord.fullName,
              assigned_driver_phone: driverRecord.phoneSanitized,
            },
          });
          linked_vehicles++;
        }
        updated++;
      }

      // Sync today's PaymentLedger morning snapshot whenever Balance is provided in the CSV
      if (parsedBalance !== null) {
        const effContract = (driverRecord.contractType || "DAILY").toUpperCase();
        const expectedMAD =
          effContract === "WEEKLY"
            ? (dayOfWeek === 1 ? 1800 : 0)
            : (dayOfWeek >= 1 && dayOfWeek <= 6 ? 300 : 0);

        const existingLedger = todayLedgerByDriverId.get(driverRecord.id);
        if (existingLedger) {
          await prisma.paymentLedger.update({
            where: { id: existingLedger.id },
            data: {
              morningBalance: parsedBalance,
              expectedMAD: expectedMAD || existingLedger.expectedMAD,
              arrearsMAD: currentArrearsMAD,
              notes: existingLedger.notes || `Solde initial (import chauffeurs): ${parsedBalance} MAD`,
            },
          }).catch(() => {});
        } else {
          const createdLedger = await prisma.paymentLedger.create({
            data: {
              driverId: driverRecord.id,
              paymentDate: targetDate,
              expectedMAD,
              clearedMAD: 0,
              arrearsMAD: currentArrearsMAD,
              morningBalance: parsedBalance,
              notes: `Solde initial (matin): ${parsedBalance} MAD`,
            },
          }).catch(() => null);
          if (createdLedger) {
            todayLedgerByDriverId.set(driverRecord.id, createdLedger);
          }
        }
      }

      // Import driver comment from CSV if present
      const rawComment = getField(row, ["comment", "comments", "commentaire", "remarque", "note", "notes"]);
      if (rawComment) {
        const existingComment = await prisma.driverComment.findFirst({
          where: {
            driverId: driverRecord.id,
            content: rawComment,
          },
        }).catch(() => null);

        if (!existingComment) {
          await prisma.driverComment.create({
            data: {
              driverId: driverRecord.id,
              authorName: "Import CSV",
              authorRole: "FLEET_PERF_MANAGER",
              content: rawComment,
              commentDate: todayStr,
            },
          }).catch(() => {});
        }
      }

      csvDriverIds.add(driverRecord.id);

      if (assignedVehicleId && matchedVehicle) {
        csvVehicleAssignments[assignedVehicleId] = {
          driverName: driverRecord.fullName,
          driverPhone: driverRecord.phoneSanitized,
          driverId: driverRecord.id,
        };
      }
    }

    // --- CHURN DETECTION LOGIC ---
    for (const vehicle of initialAssignedVehicles) {
      const csvAssignment = csvVehicleAssignments[vehicle.id];
      const previousDriverName = vehicle.assigned_driver_name;
      const previousDriverPhone = vehicle.assigned_driver_phone;

      // Never overwrite immobilized/garage/police vehicles to "Available"
      if (NON_WORKING_IMMOBILIZED_STATUSES.has(vehicle.status)) {
        continue;
      }

      if (!csvAssignment) {
        await prisma.churnEvent.create({
          data: {
            vehicle_id: vehicle.id,
            plate_number: vehicle.plate_number,
            driver_name: previousDriverName,
            driver_phone: previousDriverPhone,
            reason: "Auto-churned via CSV Upload: Vehicle is no longer in the active drivers list.",
          },
        });
        churned_drivers++;

        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            status: "Available",
            assigned_driver_name: null,
            assigned_driver_phone: null,
          },
        });
      } else if (csvAssignment.driverPhone !== previousDriverPhone) {
        await prisma.churnEvent.create({
          data: {
            vehicle_id: vehicle.id,
            plate_number: vehicle.plate_number,
            driver_name: previousDriverName,
            driver_phone: previousDriverPhone,
            reason: `Auto-churned via CSV Upload: Vehicle reassigned to new driver (${csvAssignment.driverName}).`,
          },
        });
        churned_drivers++;
      }
    }

    // --- ARCHIVE MISSING DRIVERS ---
    const csvDriverIdsArray = Array.from(csvDriverIds);
    await prisma.driverProfile.updateMany({
      where: {
        id: { notIn: csvDriverIdsArray },
        is_archived: false,
      },
      data: {
        is_archived: true,
        assignedVehicleId: null,
      },
    });

    await reconcileDriverVehicleAssignments().catch((err) => {
      console.error("Post-upload driver reconciliation error:", err);
    });

    invalidateDriverCache();
    await flushDatabaseSync();
    await touchSyncState("all");

    return NextResponse.json({
      success: true,
      summary: {
        total_rows,
        inserted,
        updated,
        skipped_invalid,
        linked_vehicles,
        churned_drivers,
        archived_drivers: await prisma.driverProfile.count({
          where: { id: { notIn: csvDriverIdsArray }, is_archived: true },
        }),
      },
    });
  } catch (error: any) {
    console.error("POST /api/upload-drivers error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process driver CSV upload" },
      { status: 500 }
    );
  }
}
