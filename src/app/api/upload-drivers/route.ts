/**
 * Bulk Driver CSV Upload API — POST /api/upload-drivers
 *
 * Parses CSV containing existing drivers, auto-sanitizes Moroccan phone numbers,
 * links vehicles if plate number matches, and bulk-inserts/upserts DriverProfile records.
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

    // Fetch all vehicles to auto-link by plate number if present
    const allVehicles = await prisma.vehicle.findMany();
    const vehicleByPlate = new Map<string, typeof allVehicles[0]>();
    for (const v of allVehicles) {
      vehicleByPlate.set(v.plate_number.replace(/\s+/g, "").toUpperCase(), v);
    }

    for (const row of data) {
      total_rows++;

      const fullName = getField(row, [
        "full name", "fullname", "nom complet", "nom", "name", "chauffeur", "driver"
      ]);
      const rawPhone = getField(row, [
        "phone", "telephone", "téléphone", "mobile", "tel", "phone number", "numero"
      ]);

      if (!fullName || !rawPhone) {
        skipped_invalid++;
        continue;
      }

      const phoneSanitized = sanitizePhone(rawPhone);
      if (phoneSanitized.length < 10) {
        skipped_invalid++;
        continue;
      }

      const rawCin = getField(row, ["cin", "cnie", "national id", "carte nationale"]);
      const cinNumber = (rawCin || `CIN-${phoneSanitized.slice(-6)}`).toUpperCase();

      const rawAge = getField(row, ["age", "âge"]);
      const age = rawAge && !isNaN(Number(rawAge)) ? Number(rawAge) : 28;

      const rawSeniority = getField(row, ["seniority", "anciennete", "ancienneté", "permis"]);
      const licenseSeniority = rawSeniority && !isNaN(Number(rawSeniority)) ? Number(rawSeniority) : 3;

      const contractType = getField(row, ["contract", "contrat", "type contrat", "contract type"]) || "STANDARD";

      const rawArrears = getField(row, ["arrears", "impayes", "impayés", "dette", "solde"]);
      const currentArrearsMAD = rawArrears && !isNaN(Number(rawArrears)) ? Number(rawArrears) : 0.0;

      const defaultStage = getField(row, ["stage", "statut", "default stage"]) || "NOMINAL";

      const rawPlate = getField(row, ["plate", "immatriculation", "matricule", "vehicule", "vehicle"]);
      let assignedVehicleId: string | null = null;

      if (rawPlate) {
        const normalizedPlate = rawPlate.replace(/\s+/g, "").toUpperCase();
        const matchedVehicle = vehicleByPlate.get(normalizedPlate);
        if (matchedVehicle) {
          assignedVehicleId = matchedVehicle.id;
        }
      }

      // Check if driver already exists by phone or CIN
      const existing = await prisma.driverProfile.findFirst({
        where: {
          OR: [
            { phoneSanitized },
            { cinNumber },
          ],
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
            },
          });
          linked_vehicles++;
        }
        inserted++;
      } else {
        // Update existing driver profile
        await prisma.driverProfile.update({
          where: { id: existing.id },
          data: {
            fullName,
            age,
            licenseSeniority,
            contractType,
            currentArrearsMAD,
            defaultStage,
            assignedVehicleId: assignedVehicleId || existing.assignedVehicleId,
          },
        });

        if (assignedVehicleId && assignedVehicleId !== existing.assignedVehicleId) {
          await prisma.vehicle.update({
            where: { id: assignedVehicleId },
            data: {
              status: "Actif",
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
        linked_vehicles,
        skipped_invalid,
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
