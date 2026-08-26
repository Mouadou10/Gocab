import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 1. Auto-sync: Find any vehicles with status 'Accident' that do not have an open AccidentClaim
    const accidentVehicles = await prisma.vehicle.findMany({
      where: { status: "Accident" },
      include: {
        driverProfile: true,
        accidentClaims: {
          where: { timeline_step: { not: "VEHICLE_BACK" } },
        },
      },
    });

    for (const vehicle of accidentVehicles) {
      if (!vehicle.accidentClaims || vehicle.accidentClaims.length === 0) {
        // Auto-create missing accident claim
        await prisma.accidentClaim.create({
          data: {
            vehicle_id: vehicle.id,
            driver_id: vehicle.driverProfile?.id || null,
            driver_name: vehicle.assigned_driver_name || vehicle.driverProfile?.fullName || null,
            driver_phone: vehicle.assigned_driver_phone || vehicle.driverProfile?.phoneSanitized || null,
            timeline_step: "NEW_ACCIDENT",
            severity: "HARD",
            step_updated_at: new Date(),
          },
        });
      }
    }

    const claims = await prisma.accidentClaim.findMany({
      include: {
        vehicle: true,
        driver: true,
      },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ success: true, claims });
  } catch (error: any) {
    console.error("Error fetching accident claims:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { vehicle_id, driver_id, driver_name, driver_phone, severity, fault } = body;

    if (!vehicle_id) {
      return NextResponse.json({ success: false, error: "vehicle_id is required" }, { status: 400 });
    }

    // Create the accident claim
    const claim = await prisma.accidentClaim.create({
      data: {
        vehicle_id,
        driver_id,
        driver_name,
        driver_phone,
        severity,
        fault,
      },
      include: {
        vehicle: true,
        driver: true,
      }
    });

    // Also update the vehicle's status to Accident
    await prisma.vehicle.update({
      where: { id: vehicle_id },
      data: { status: "Accident" }
    });

    return NextResponse.json({ success: true, claim });
  } catch (error: any) {
    console.error("Error creating accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
