import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const now = new Date();
    // Midnight of current day for date-only comparisons
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Fetch all active vehicles that have at least one regulatory document configured
    const allVehicles = await prisma.vehicle.findMany({
      where: {
        is_archived: false,
        OR: [
          { autorisation_expiry_date: { not: null } },
          { insurance_expiry_date: { not: null } },
          { vignette_expiry_date: { not: null } },
          { technical_inspection_expiry: { not: null } },
        ],
      },
    });

    // 2. Filter strictly for vehicles with documents expiring in <= 3 days or already expired
    const dueVehiclesWithDocs: any[] = [];

    for (const v of allVehicles) {
      const docChecks = [
        { name: "Autorisation", date: v.autorisation_expiry_date },
        { name: "Assurance", date: v.insurance_expiry_date },
        { name: "Vignette", date: v.vignette_expiry_date },
        { name: "Visite Technique", date: v.technical_inspection_expiry },
      ];

      const urgentDocs: { name: string; date: Date; days_left: number; is_expired: boolean }[] = [];

      for (const doc of docChecks) {
        if (doc.date) {
          const exp = new Date(doc.date);
          const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
          const diffMs = expDay.getTime() - today.getTime();
          const daysLeft = Math.round(diffMs / (1000 * 3600 * 24));

          // Condition: 3 days or fewer remaining (daysLeft <= 3), or already expired (daysLeft < 0)
          if (daysLeft <= 3) {
            urgentDocs.push({
              name: doc.name,
              date: exp,
              days_left: daysLeft,
              is_expired: daysLeft < 0,
            });
          }
        }
      }

      if (urgentDocs.length > 0) {
        // Sort urgent docs by earliest expiry (lowest days_left first)
        urgentDocs.sort((a, b) => a.days_left - b.days_left);
        const mostUrgent = urgentDocs[0];

        dueVehiclesWithDocs.push({
          vehicle: v,
          urgentDocs,
          mostUrgent,
        });
      }
    }

    if (dueVehiclesWithDocs.length === 0) {
      return NextResponse.json({ checkupsDue: [] });
    }

    // Sort vehicles: most overdue first (lowest days_left)
    dueVehiclesWithDocs.sort((a, b) => a.mostUrgent.days_left - b.mostUrgent.days_left);

    // 3. Fetch latest inspection for these due vehicles
    const vehicleIds = dueVehiclesWithDocs.map((item) => item.vehicle.id);
    const previousInspections = await prisma.vehicleInspection.findMany({
      where: {
        vehicle_id: { in: vehicleIds },
      },
      orderBy: { inspection_date: "desc" },
    });

    const latestInspectionMap = new Map();
    for (const insp of previousInspections) {
      if (!latestInspectionMap.has(insp.vehicle_id)) {
        latestInspectionMap.set(insp.vehicle_id, insp);
      }
    }

    // 4. Build final response list
    const checkupsDue = dueVehiclesWithDocs.map(({ vehicle: v, urgentDocs, mostUrgent }) => {
      const prev = latestInspectionMap.get(v.id);

      return {
        vehicle_id: v.id,
        plate_number: v.plate_number,
        make_model: v.make_model,
        assigned_driver_name: v.assigned_driver_name,
        assigned_driver_phone: v.assigned_driver_phone,
        previous_health_score: prev ? prev.health_score : null,
        previous_inspection_date: prev ? prev.inspection_date : null,
        document_name: mostUrgent.name,
        document_expiry_date: mostUrgent.date.toISOString(),
        autorisation_expiry_date: v.autorisation_expiry_date,
        insurance_expiry_date: v.insurance_expiry_date,
        vignette_expiry_date: v.vignette_expiry_date,
        technical_inspection_expiry: v.technical_inspection_expiry,
        days_left: mostUrgent.days_left,
        is_expired: mostUrgent.is_expired,
        urgent_docs: urgentDocs.map((d) => ({
          name: d.name,
          date: d.date.toISOString(),
          days_left: d.days_left,
          is_expired: d.is_expired,
        })),
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
