import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 1. Fetch all vehicles currently in "Accident" status
    const accidentVehicles = await prisma.vehicle.findMany({
      where: {
        status: { in: ["Accident", "accident", "Accidenté"] },
      },
      include: {
        driverProfile: true,
      },
    });

    // 2. Fetch all existing claims
    let claims = await prisma.accidentClaim.findMany({
      include: {
        vehicle: true,
        driver: true,
      },
      orderBy: { created_at: "desc" },
    });

    // Set of vehicle IDs that already have an ACTIVE claim (not VEHICLE_BACK)
    const activeClaimVehicleIds = new Set(
      claims
        .filter((c) => c.timeline_step !== "VEHICLE_BACK")
        .map((c) => c.vehicle_id)
    );

    // Reference date: check if existing claims have a common creation date (e.g. 13 days ago)
    const sampleActiveClaim = claims.find((c) => c.timeline_step !== "VEHICLE_BACK");
    const defaultCreatedAt = sampleActiveClaim?.created_at || new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);

    // 3. For any vehicle in "Accident" status missing an active claim, auto-create it
    let hasCreatedClaims = false;
    for (const v of accidentVehicles) {
      if (!activeClaimVehicleIds.has(v.id)) {
        // Look up driver if not linked directly
        let driver = v.driverProfile;
        if (!driver && v.assigned_driver_name) {
          driver = await prisma.driverProfile.findFirst({
            where: {
              OR: [
                { fullName: { contains: v.assigned_driver_name.trim() } },
                { assignedVehicleId: v.id },
              ],
            },
          }).catch(() => null);
        }

        const claimDate = v.total_downtime_days && v.total_downtime_days > 0
          ? new Date(Date.now() - v.total_downtime_days * 24 * 60 * 60 * 1000)
          : defaultCreatedAt;

        await prisma.accidentClaim.create({
          data: {
            vehicle_id: v.id,
            driver_id: driver?.id || null,
            driver_name: v.assigned_driver_name || driver?.fullName || null,
            driver_phone: v.assigned_driver_phone || driver?.phoneSanitized || null,
            severity: "HARD",
            fault: null,
            timeline_step: "CAR_IN_GARAGE",
            step_updated_at: claimDate,
            created_at: claimDate,
            comments: JSON.stringify([
              {
                id: crypto.randomUUID(),
                timeline_step: "CAR_IN_GARAGE",
                comment: "Dossier accident synchronisé automatiquement depuis la flotte.",
                author: "Système",
                created_at: claimDate.toISOString(),
              },
            ]),
          },
        });
        hasCreatedClaims = true;

        // Ensure Support ticket also exists
        const existingSupportTicket = await prisma.maintenanceTicket.findFirst({
          where: {
            vehicle_id: v.id,
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
        });

        if (!existingSupportTicket) {
          await prisma.maintenanceTicket.create({
            data: {
              vehicle_id: v.id,
              plate_number: v.plate_number,
              driver_name: v.assigned_driver_name || driver?.fullName || null,
              driver_phone: v.assigned_driver_phone || driver?.phoneSanitized || null,
              ticket_type: "Accident",
              priority: (v.total_downtime_days || 0) >= 7 ? "Critical" : "Urgent",
              status: "OPEN",
              description: `💥 Véhicule en statut Accidenté. Réparation & assurance requises.`,
              created_at: claimDate,
              sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
        }
      }
    }

    // 4. If any active claim belongs to a vehicle that is NO LONGER in "Accident" status, sync to VEHICLE_BACK
    const accidentVehicleIds = new Set(accidentVehicles.map((v) => v.id));
    let hasUpdatedClaims = false;
    for (const c of claims) {
      if (c.timeline_step !== "VEHICLE_BACK" && c.vehicle && !accidentVehicleIds.has(c.vehicle_id)) {
        // Vehicle is now Actif, Available, or In garage -> resolve the claim
        await prisma.accidentClaim.update({
          where: { id: c.id },
          data: {
            timeline_step: "VEHICLE_BACK",
            step_updated_at: new Date(),
          },
        });
        hasUpdatedClaims = true;
      }
    }

    // If changes occurred, reload updated claims list
    if (hasCreatedClaims || hasUpdatedClaims) {
      claims = await prisma.accidentClaim.findMany({
        include: {
          vehicle: true,
          driver: true,
        },
        orderBy: { created_at: "desc" },
      });
    }

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

    // Lookup vehicle to enrich claim with driver info if not explicitly passed
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle_id },
      include: { driverProfile: true },
    });

    const finalDriverName = driver_name || vehicle?.assigned_driver_name || vehicle?.driverProfile?.fullName || null;
    const finalDriverPhone = driver_phone || vehicle?.assigned_driver_phone || vehicle?.driverProfile?.phoneSanitized || null;
    const finalDriverId = driver_id || vehicle?.driverProfile?.id || null;

    // Create the accident claim
    const claim = await prisma.accidentClaim.create({
      data: {
        vehicle_id,
        driver_id: finalDriverId,
        driver_name: finalDriverName,
        driver_phone: finalDriverPhone,
        severity: severity || "HARD",
        fault: fault || null,
        timeline_step: "NEW_ACCIDENT",
        comments: JSON.stringify([
          {
            id: crypto.randomUUID(),
            timeline_step: "NEW_ACCIDENT",
            comment: "Dossier accident ouvert manuellement par l'agent depuis la page Assurance.",
            author: "Agent",
            created_at: new Date().toISOString(),
          },
        ]),
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

    // Also ensure a Support ticket exists
    const existingTicket = await prisma.maintenanceTicket.findFirst({
      where: {
        vehicle_id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    });

    if (!existingTicket && vehicle) {
      await prisma.maintenanceTicket.create({
        data: {
          vehicle_id,
          plate_number: vehicle.plate_number,
          driver_name: finalDriverName,
          driver_phone: finalDriverPhone,
          ticket_type: "Accident",
          priority: "Urgent",
          status: "OPEN",
          description: `💥 Véhicule signalé en accident depuis la page Assurance. Réparation mécanique requise.`,
          sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }).catch((e: any) => console.warn("Could not create support ticket:", e));
    }

    return NextResponse.json({ success: true, claim });
  } catch (error: any) {
    console.error("Error creating accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
