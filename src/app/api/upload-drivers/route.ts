/**
 * Bulk Driver CSV Upload API — POST /api/upload-drivers
 *
 * Parses CSV containing drivers (handles GoCab spreadsheet with Phone Number, Name, Gender, Balance, ID Number, Vehicles),
 * auto-sanitizes Moroccan phone numbers, computes debt/arrears from negative balance,
 * performs intelligent multi-pattern matching to vehicles by immatriculation / WW variations,
 * and bulk-inserts/upserts DriverProfile records.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
    }

    const csvText = await file.text();

    const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
    });

    if (errors.length > 0) {
      console.warn("CSV parse warnings:", errors);
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Empty CSV file" }, { status: 400 });
    }

    // Helper to find column by multiple possible aliases
    const getField = (row: Record<string, string>, aliases: string[]): string | undefined => {
      for (const alias of aliases) {
        const val = row[alias.toLowerCase()];
        if (val && val.trim()) return val.trim();
      }
      return undefined;
    };

    let total_rows = 0;
    let inserted = 0;
    let updated = 0;
    let skipped_invalid = 0;
    let linked_vehicles = 0;

    // Fetch all vehicles to enable multi-pattern fuzzy matching
    const allVehicles = await prisma.vehicle.findMany();

    // Fetch the snapshot of currently assigned vehicles BEFORE we process the CSV
    // This allows us to compare against the final state to detect churn.
    const initialAssignedVehicles = await prisma.vehicle.findMany({
      where: {
        assigned_driver_name: { not: null },
      },
      include: { driverProfile: true },
    });

    // Helper to find vehicle by immat
    const findMatchingVehicle = (rawPlate: string) => {
      if (!rawPlate) return null;
      const targetNorm = normalizePlate(rawPlate);
      if (!targetNorm) return null;

      // 1. Direct normalized match on plate_number
      for (const v of allVehicles) {
        if (normalizePlate(v.plate_number) === targetNorm) return v;
      }

      // 2. WW prefix vs suffix match (e.g. 860502-WW vs WW860502, WW964990 vs 964990-WW)
      const targetDigits = targetNorm.replace(/WW/g, "");
      if (targetDigits.length >= 4) {
        for (const v of allVehicles) {
          const vNorm = normalizePlate(v.plate_number);
          const vDigits = vNorm.replace(/WW/g, "");
          if (vDigits === targetDigits) return v;
        }
      }

      // 3. Search in vehicle notes (e.g. "Ancien N°: 860533-WW" or "Old Number")
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

    // Track what is assigned in the CSV to detect churn
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

      const phoneSanitized = rawPhone ? sanitizePhone(rawPhone) : `+212600${Math.floor(100000 + Math.random() * 900000)}`;

      // ID Number (CIN)
      const rawCin = getField(row, [
        "id number", "cin", "cnie", "id", "national id", "carte nationale", "n° cin", "id num"
      ]);
      const cinNumber = (rawCin ? rawCin.replace(/\s+/g, "") : `CIN-${phoneSanitized.slice(-6)}`).toUpperCase();

      // Contract Type: "WEEKLY" (1800 MAD every Monday) or "DAILY" (300 MAD/day Mon-Sat)
      const rawContract = getField(row, ["type contrat", "contrat", "contract", "type", "contract type", "formule"]);
      let contractType = "DAILY";
      if (rawContract) {
        const norm = rawContract.toLowerCase();
        if (norm.includes("week") || norm.includes("hebdo") || norm.includes("1800") || norm.includes("lundi")) {
          contractType = "WEEKLY";
        } else {
          contractType = "DAILY";
        }
      }

      // Parse Balance / Arrears (Negative balance like -2000 means 2000 MAD debt)
      const rawBalance = getField(row, ["impayes mad", "impayes", "impayés", "balance", "solde", "arrears", "dette"]);
      let currentArrearsMAD = 0.0;
      if (rawBalance && !isNaN(Number(rawBalance))) {
        const num = Number(rawBalance);
        currentArrearsMAD = num < 0 ? Math.abs(num) : num > 0 ? num : 0.0;
      }

      // Default stage from arrears or explicit stage column
      const explicitStage = getField(row, ["stage", "statut", "default stage", "recouvrement"]);
      let defaultStage = explicitStage || "NOMINAL";
      if (!explicitStage && currentArrearsMAD > 0) {
        if (currentArrearsMAD >= 1500) defaultStage = "DAY_3_BLOCK";
        else if (currentArrearsMAD >= 1000) defaultStage = "DAY_2_ACTION";
        else defaultStage = "DAY_1_WARNING";
      }

      // Match vehicle by Vehicles / Immatriculation
      const rawPlate = getField(row, [
        "immatriculation", "immatriculatio", "vehicles", "vehicle", "plate", "matricule", "vehicule", "vehicules", "immat", "plate number", "registration", "old number"
      ]);
      
      let assignedVehicleId: string | null = null;
      let matchedVehicle = rawPlate ? findMatchingVehicle(rawPlate) : null;

      if (matchedVehicle) {
        assignedVehicleId = matchedVehicle.id;
      }

      // Check if driver already exists by phone, CIN, Name, or previous vehicle link
      const existing = await prisma.driverProfile.findFirst({
        where: {
          OR: [
            rawPhone ? { phoneSanitized } : null,
            rawCin ? { cinNumber } : null,
            { fullName },
            assignedVehicleId ? { assignedVehicleId } : null,
          ].filter(Boolean) as any,
        },
      });

      let driverRecord;

      if (!existing) {
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
            consecutiveUnpaidDays: currentArrearsMAD >= 600 ? 2 : currentArrearsMAD >= 300 ? 1 : 0,
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
        // Update existing driver profile with real contact info, while preserving or updating vehicle
        const finalVehicleId = assignedVehicleId || existing.assignedVehicleId;

        driverRecord = await prisma.driverProfile.update({
          where: { id: existing.id },
          data: {
            fullName,
            phoneSanitized: rawPhone ? phoneSanitized : existing.phoneSanitized,
            cinNumber: rawCin ? cinNumber : existing.cinNumber,
            contractType: rawContract ? contractType : existing.contractType,
            currentArrearsMAD: rawBalance ? currentArrearsMAD : existing.currentArrearsMAD,
            consecutiveUnpaidDays: currentArrearsMAD >= 600 ? 2 : currentArrearsMAD >= 300 ? 1 : existing.consecutiveUnpaidDays,
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

      csvDriverIds.add(driverRecord.id);

      // Record this assignment for the churn check later
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

      // 1. Vehicle is missing entirely from the CSV OR is no longer assigned to anyone in the CSV
      if (!csvAssignment) {
        await prisma.churnEvent.create({
          data: {
            vehicle_id: vehicle.id,
            plate_number: vehicle.plate_number,
            driver_name: previousDriverName,
            driver_phone: previousDriverPhone,
            reason: "Auto-churned via CSV Upload: Vehicle is no longer in the active drivers list.",
          }
        });
        churned_drivers++;

        // Free up the vehicle
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            status: "Available",
            assigned_driver_name: null,
            assigned_driver_phone: null,
          }
        });
      } 
      // 2. Vehicle changed hands (assigned to a DIFFERENT driver in the CSV)
      else if (csvAssignment.driverPhone !== previousDriverPhone) {
        await prisma.churnEvent.create({
          data: {
            vehicle_id: vehicle.id,
            plate_number: vehicle.plate_number,
            driver_name: previousDriverName,
            driver_phone: previousDriverPhone,
            reason: `Auto-churned via CSV Upload: Vehicle reassigned to new driver (${csvAssignment.driverName}).`,
          }
        });
        churned_drivers++;
      }
    }

    // --- ARCHIVE MISSING DRIVERS ---
    // Any driver NOT in this CSV should be archived and unassigned, since CSV is the single source of truth.
    const csvDriverIdsArray = Array.from(csvDriverIds);
    await prisma.driverProfile.updateMany({
      where: {
        id: { notIn: csvDriverIdsArray },
        is_archived: false // Only update those not already archived
      },
      data: {
        is_archived: true,
        assignedVehicleId: null
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        total_rows,
        inserted,
        updated,
        skipped_invalid,
        linked_vehicles,
        churned_drivers,
        archived_drivers: (await prisma.driverProfile.count({ where: { id: { notIn: csvDriverIdsArray }, is_archived: true } })) // Note: This count includes previously archived drivers, but gives a general sense.
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
