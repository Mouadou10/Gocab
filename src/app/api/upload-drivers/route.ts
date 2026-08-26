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

      const rawAge = getField(row, ["age", "âge"]);
      const age = rawAge && !isNaN(Number(rawAge)) ? Number(rawAge) : 28;

      const rawSeniority = getField(row, [
        "seniority", "anciennete", "ancienneté", "permis", "anciennete permis", "license seniority"
      ]);
      const licenseSeniority = rawSeniority && !isNaN(Number(rawSeniority)) ? Number(rawSeniority) : 3;

      const contractType = getField(row, ["contract", "contrat", "type contrat", "contract type"]) || "STANDARD";

      // Parse Balance / Arrears (Negative balance like -2000 means 2000 MAD debt)
      const rawBalance = getField(row, ["balance", "solde", "arrears", "impayes", "impayés", "dette", "impayes mad"]);
      let currentArrearsMAD = 0.0;
      if (rawBalance && !isNaN(Number(rawBalance))) {
        const num = Number(rawBalance);
        currentArrearsMAD = num < 0 ? Math.abs(num) : 0.0;
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
        "vehicles", "vehicle", "plate", "immatriculation", "matricule", "vehicule", "vehicules", "immat", "plate number", "registration", "old number"
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
            { phoneSanitized: rawPhone ? phoneSanitized : undefined },
            { cinNumber: rawCin ? cinNumber : undefined },
            { fullName: { equals: fullName } },
            ...(assignedVehicleId ? [{ assignedVehicleId }] : []),
          ].filter(Boolean) as any,
        },
      });

      if (!existing) {
        const created = await prisma.driverProfile.create({
          data: {
            fullName,
            phoneSanitized,
            cinNumber,
            age,
            licenseSeniority,
            contractType,
            currentArrearsMAD,
            defaultStage,
            isKycVerified: true,
            monthlyTripCount: 0,
            assignedVehicleId,
          },
        });

        if (assignedVehicleId) {
          await prisma.vehicle.update({
            where: { id: assignedVehicleId },
            data: {
              status: "Actif",
              assigned_driver_name: created.fullName,
              assigned_driver_phone: created.phoneSanitized,
            },
          });
          linked_vehicles++;
        }
        inserted++;
      } else {
        // Update existing driver profile with real contact info, while preserving or updating vehicle
        const finalVehicleId = assignedVehicleId || existing.assignedVehicleId;

        const updatedDriver = await prisma.driverProfile.update({
          where: { id: existing.id },
          data: {
            fullName,
            phoneSanitized: rawPhone ? phoneSanitized : existing.phoneSanitized,
            cinNumber: rawCin ? cinNumber : existing.cinNumber,
            age,
            licenseSeniority,
            contractType,
            currentArrearsMAD: currentArrearsMAD > 0 ? currentArrearsMAD : existing.currentArrearsMAD,
            defaultStage,
            assignedVehicleId: finalVehicleId,
          },
        });

        if (finalVehicleId) {
          await prisma.vehicle.update({
            where: { id: finalVehicleId },
            data: {
              status: "Actif",
              assigned_driver_name: updatedDriver.fullName,
              assigned_driver_phone: updatedDriver.phoneSanitized,
            },
          });
          linked_vehicles++;
        }
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_rows,
        inserted,
        updated,
        skipped_invalid,
        linked_vehicles,
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
