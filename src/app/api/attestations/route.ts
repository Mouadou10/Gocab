import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { calculateOneMonthPeriod } from "@/lib/attestationDate";

export const dynamic = "force-dynamic";

/**
 * GET /api/attestations
 * Retrieves attestation info & 1-month period calculation for a vehicle.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicle_id") || searchParams.get("vehicleId") || "";
    const plateNumber = searchParams.get("plate_number") || searchParams.get("immat") || "";

    if (!vehicleId && !plateNumber) {
      return NextResponse.json({ error: "vehicle_id or plate_number is required." }, { status: 400 });
    }

    const where: any = {};
    if (vehicleId) {
      where.id = vehicleId;
    } else {
      where.plate_number = plateNumber.trim();
    }

    const vehicle = await prisma.vehicle.findFirst({
      where,
      include: { driverProfile: true },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const latestInspection = await prisma.vehicleInspection.findFirst({
      where: { vehicle_id: vehicle.id },
      orderBy: { inspection_date: "desc" },
    });

    const period = vehicle.autorisation_expiry_date
      ? calculateOneMonthPeriod(
          new Date(new Date(vehicle.autorisation_expiry_date).getTime() - 30 * 24 * 60 * 60 * 1000)
        )
      : null;

    return NextResponse.json({
      vehicle,
      latestInspection,
      period,
    });
  } catch (error: any) {
    console.error("GET /api/attestations error:", error);
    return NextResponse.json({ error: "Failed to fetch attestation details" }, { status: 500 });
  }
}

/**
 * POST /api/attestations
 * Saves an Attestation de Location de Voiture:
 * 1. Takes the attestation date as the FIRST DAY of the 1-month rental period.
 * 2. Calculates the 1-month expiration date (Day 1 + 1 month).
 * 3. Saves it to the vehicle's `autorisation_expiry_date` so that month-end warnings trigger automatically.
 * 4. Records or updates the vehicle's inspection history.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      vehicleId,
      immat,
      fullName,
      cin,
      brand,
      chassisNumber,
      date,
      inspectionId,
    } = body;

    const plateClean = (immat || "").trim();
    if (!plateClean && !vehicleId) {
      return NextResponse.json(
        { error: "L'immatriculation du véhicule ou l'identifiant est requis." },
        { status: 400 }
      );
    }

    // 1. Calculate 1-month period based on date on attestation as the First Day
    const period = calculateOneMonthPeriod(date);

    // 2. Find the vehicle in the database
    let vehicle = null;
    if (vehicleId) {
      vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: { driverProfile: true },
      });
    }

    if (!vehicle && plateClean) {
      // Try exact, then normalized plate match
      vehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { plate_number: plateClean },
            { plate_number: plateClean.replace(/[\s\-_]/g, "") },
            { plate_number: { contains: plateClean } },
          ],
        },
        include: { driverProfile: true },
      });
    }

    if (!vehicle) {
      return NextResponse.json(
        { error: `Véhicule introuvable pour le matricule "${plateClean}".` },
        { status: 404 }
      );
    }

    // 3. Update Vehicle: set autorisation_expiry_date to the 1-month expiration date
    const vehicleUpdateData: any = {
      autorisation_expiry_date: period.expiryDate,
    };

    if (fullName && (!vehicle.assigned_driver_name || vehicle.assigned_driver_name === "Sans chauffeur")) {
      vehicleUpdateData.assigned_driver_name = fullName.trim();
    }
    if (chassisNumber && !vehicle.vin) {
      vehicleUpdateData.vin = chassisNumber.trim();
    }
    if (brand && (!vehicle.make_model || vehicle.make_model === "Inconnu")) {
      vehicleUpdateData.make_model = brand.trim();
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: vehicleUpdateData,
    });

    // 4. Update or sync driver profile if CIN or fullName is provided
    if (cin || fullName) {
      const cinClean = (cin || "").trim();
      if (cinClean) {
        await prisma.driverProfile.updateMany({
          where: {
            OR: [
              { cinNumber: cinClean },
              { assignedVehicleId: vehicle.id },
            ],
          },
          data: {
            ...(fullName ? { fullName: fullName.trim() } : {}),
            cinNumber: cinClean,
          },
        }).catch((e) => console.warn("Failed to update driver profile on attestation save:", e));
      }
    }

    // 5. Update or record VehicleInspection
    let savedInspection = null;
    if (inspectionId) {
      savedInspection = await prisma.vehicleInspection.update({
        where: { id: inspectionId },
        data: {
          inspection_date: period.startDate,
          notes: `Attestation de Location (1 Mois) enregistrée. Période : du ${period.formattedStartDate} au ${period.formattedExpiryDate}.`,
        },
      }).catch(() => null);
    }

    if (!savedInspection) {
      savedInspection = await prisma.vehicleInspection.create({
        data: {
          vehicle_id: vehicle.id,
          plate_number: vehicle.plate_number,
          inspector_name: "Hamza RASSID (Gérant)",
          inspection_date: period.startDate,
          current_mileage: vehicle.current_mileage || 0,
          health_score: 5.0,
          notes: `Attestation de Location de Voiture (1 Mois renouvelable). Période active : du ${period.formattedStartDate} au ${period.formattedExpiryDate}.`,
        },
      }).catch((e) => {
        console.warn("Failed to create inspection record for attestation:", e);
        return null;
      });
    }

    // 6. Notify live sync so open tabs (Fleet, Field, Tickets) update immediately
    touchSyncState("tickets").catch(() => {});
    touchSyncState("settings").catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Attestation enregistrée pour le véhicule ${vehicle.plate_number}. Période de 1 mois active jusqu'au ${period.formattedExpiryDate}.`,
      startDate: period.startDate.toISOString(),
      expiryDate: period.expiryDate.toISOString(),
      formattedStartDate: period.formattedStartDate,
      formattedExpiryDate: period.formattedExpiryDate,
      daysLeft: period.daysLeft,
      isEndingSoon: period.isEndingSoon,
      isExpired: period.isExpired,
      vehicle: updatedVehicle,
      inspection: savedInspection,
    });
  } catch (error: any) {
    console.error("POST /api/attestations error:", error);
    return NextResponse.json(
      { error: error?.message || "Échec de l'enregistrement de l'attestation" },
      { status: 500 }
    );
  }
}
