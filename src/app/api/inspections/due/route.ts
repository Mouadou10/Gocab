import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Find all inspections that happened this month
    const inspectedThisMonth = await prisma.vehicleInspection.findMany({
      where: {
        inspection_date: {
          gte: firstDayOfMonth,
        },
      },
      select: {
        vehicle_id: true,
      },
    });

    const inspectedVehicleIds = new Set(inspectedThisMonth.map((i) => i.vehicle_id));

    // 2. Fetch vehicles that have an Autorisation Expiry date configured and are not archived
    const vehiclesWithAutorisation = await prisma.vehicle.findMany({
      where: {
        autorisation_expiry_date: {
          not: null,
        },
        is_archived: false,
      },
      orderBy: { autorisation_expiry_date: "asc" },
    });

    // 3. Filter for vehicles that HAVE NOT been inspected this month
    const dueVehicles = vehiclesWithAutorisation.filter((v) => !inspectedVehicleIds.has(v.id));

    if (dueVehicles.length === 0) {
      return NextResponse.json({ checkupsDue: [] });
    }

    // 4. Fetch the most recent inspection for these due vehicles (to show their previous score)
    const previousInspections = await prisma.vehicleInspection.findMany({
      where: {
        vehicle_id: { in: dueVehicles.map((v) => v.id) },
      },
      orderBy: { inspection_date: "desc" },
    });

    const latestInspectionMap = new Map();
    for (const insp of previousInspections) {
      if (!latestInspectionMap.has(insp.vehicle_id)) {
        latestInspectionMap.set(insp.vehicle_id, insp);
      }
    }

    // 5. Build the final response list with Autorisation Expiry details
    const checkupsDue = dueVehicles.map((v) => {
      const prev = latestInspectionMap.get(v.id);
      const expiryDate = v.autorisation_expiry_date ? new Date(v.autorisation_expiry_date) : null;
      const daysLeft = expiryDate
        ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
        : null;

      return {
        vehicle_id: v.id,
        plate_number: v.plate_number,
        make_model: v.make_model,
        assigned_driver_name: v.assigned_driver_name,
        assigned_driver_phone: v.assigned_driver_phone,
        previous_health_score: prev ? prev.health_score : null,
        previous_inspection_date: prev ? prev.inspection_date : null,
        autorisation_expiry_date: v.autorisation_expiry_date,
        days_left: daysLeft,
        is_expired: daysLeft !== null && daysLeft < 0,
      };
    });

    return NextResponse.json({ checkupsDue });
  } catch (error: any) {
    console.error("GET /api/inspections/due error:", error);
    return NextResponse.json(
      { error: "Failed to fetch due checkups", details: error.message },
      { status: 500 }
    );
  }
}
