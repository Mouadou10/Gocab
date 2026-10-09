import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const MAINTENANCE_STATUSES = [
      "Accident",
      "accident",
      "Accidenté",
      "In garage",
      "in garage",
      "Maintenance",
      "maintenance",
    ];

    // 1. Fetch all non-archived vehicles currently in maintenance or accident status
    const maintenanceVehicles = await prisma.vehicle.findMany({
      where: {
        status: { in: MAINTENANCE_STATUSES },
        is_archived: false,
      },
      include: {
        driverProfile: true,
      },
    });

    const maintenanceVehicleIds = new Set(maintenanceVehicles.map((v) => v.id));

    // 2. Fetch all existing claims
    let allClaims = await prisma.accidentClaim.findMany({
      include: {
        vehicle: true,
        driver: {
          include: {
            accidentClaims: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Group claims by vehicle_id
    const claimsByVehicleId = new Map<string, typeof allClaims>();
    for (const c of allClaims) {
      if (c.vehicle_id) {
        const list = claimsByVehicleId.get(c.vehicle_id) || [];
        list.push(c);
        claimsByVehicleId.set(c.vehicle_id, list);
      }
    }

    let hasMutated = false;

    // 3. For any vehicle in maintenance status (In garage, Accident, etc.):
    // Requirement: "if there is a maintenance status need to be in dossiers en cours and get removed from retablis"
    for (const v of maintenanceVehicles) {
      const vClaims = claimsByVehicleId.get(v.id) || [];
      const activeClaim = vClaims.find((c) => c.timeline_step !== "VEHICLE_BACK");

      if (activeClaim) {
        // Vehicle already has an active claim in "Dossiers En Cours".
        // Clean up any old completed duplicates in "VEHICLE_BACK" so it is completely removed from retablis!
        const restoredDuplicates = vClaims.filter((c) => c.timeline_step === "VEHICLE_BACK");
        if (restoredDuplicates.length > 0) {
          await prisma.accidentClaim.deleteMany({
            where: { id: { in: restoredDuplicates.map((c) => c.id) } },
          });
          hasMutated = true;
        }
        const extraActiveDuplicates = vClaims.filter((c) => c.timeline_step !== "VEHICLE_BACK" && c.id !== activeClaim.id);
        if (extraActiveDuplicates.length > 0) {
          await prisma.accidentClaim.deleteMany({
            where: { id: { in: extraActiveDuplicates.map((c) => c.id) } },
          });
          hasMutated = true;
        }
      } else if (vClaims.length > 0) {
        // Vehicle is in maintenance, but its claims are currently in VEHICLE_BACK (in retablis).
        // Move the primary claim back to CAR_IN_GARAGE so it is in "Dossiers En Cours" and removed from "retablis"!
        const sortedClaims = [...vClaims].sort((a, b) => {
          let aComments = 0;
          let bComments = 0;
          try { aComments = a.comments ? JSON.parse(a.comments).length : 0; } catch {}
          try { bComments = b.comments ? JSON.parse(b.comments).length : 0; } catch {}
          return bComments - aComments;
        });
        const primaryClaim = sortedClaims[0];
        const extraDuplicates = sortedClaims.slice(1);

        const claimDate = v.total_downtime_days && v.total_downtime_days > 0
          ? new Date(Date.now() - v.total_downtime_days * 24 * 60 * 60 * 1000)
          : primaryClaim.created_at;

        await prisma.accidentClaim.update({
          where: { id: primaryClaim.id },
          data: {
            timeline_step: "CAR_IN_GARAGE",
            step_updated_at: claimDate,
            driver_name: v.assigned_driver_name || v.driverProfile?.fullName || primaryClaim.driver_name,
            driver_phone: v.assigned_driver_phone || v.driverProfile?.phoneSanitized || primaryClaim.driver_phone,
          },
        });

        if (extraDuplicates.length > 0) {
          await prisma.accidentClaim.deleteMany({
            where: { id: { in: extraDuplicates.map((c) => c.id) } },
          });
        }
        hasMutated = true;
      } else {
        // Vehicle in maintenance with no claim at all -> create one in CAR_IN_GARAGE
        const claimDate = v.total_downtime_days && v.total_downtime_days > 0
          ? new Date(Date.now() - v.total_downtime_days * 24 * 60 * 60 * 1000)
          : new Date();

        await prisma.accidentClaim.create({
          data: {
            vehicle_id: v.id,
            driver_id: v.driverProfile?.id || null,
            driver_name: v.assigned_driver_name || v.driverProfile?.fullName || null,
            driver_phone: v.assigned_driver_phone || v.driverProfile?.phoneSanitized || null,
            severity: "HARD",
            fault: null,
            timeline_step: "CAR_IN_GARAGE",
            step_updated_at: claimDate,
            created_at: claimDate,
            comments: JSON.stringify([
              {
                id: crypto.randomUUID(),
                timeline_step: "CAR_IN_GARAGE",
                comment: "Dossier maintenance synchronisé automatiquement depuis la flotte.",
                author: "Système",
                created_at: claimDate.toISOString(),
              },
            ]),
          },
        });
        hasMutated = true;
      }

      // Ensure open MaintenanceTicket exists
      const existingTicket = await prisma.maintenanceTicket.findFirst({
        where: {
          vehicle_id: v.id,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      });

      if (!existingTicket) {
        await prisma.maintenanceTicket.create({
          data: {
            vehicle_id: v.id,
            plate_number: v.plate_number,
            driver_name: v.assigned_driver_name || v.driverProfile?.fullName || null,
            driver_phone: v.assigned_driver_phone || v.driverProfile?.phoneSanitized || null,
            ticket_type: v.status === "Accident" ? "Accident" : "Entretien",
            priority: (v.total_downtime_days || 0) >= 7 ? "Critical" : "Urgent",
            status: "OPEN",
            description: `🔧 Véhicule en maintenance / garage. Prise en charge mécanique & assurance requise.`,
            sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        }).catch(() => null);
      }
    }

    // 4. For any active claim whose vehicle is NO LONGER in maintenance status (e.g. Actif or Available):
    // Sync to VEHICLE_BACK
    for (const c of allClaims) {
      if (c.timeline_step !== "VEHICLE_BACK" && c.vehicle && !maintenanceVehicleIds.has(c.vehicle_id)) {
        await prisma.accidentClaim.update({
          where: { id: c.id },
          data: {
            timeline_step: "VEHICLE_BACK",
            step_updated_at: new Date(),
          },
        });
        hasMutated = true;
      }
    }

    // 5. Reload and ensure no duplicate records in VEHICLE_BACK for the same vehicle
    const refreshedClaims = hasMutated
      ? await prisma.accidentClaim.findMany({
          include: {
            vehicle: true,
            driver: {
              include: {
                accidentClaims: true,
              },
            },
          },
          orderBy: { created_at: "desc" },
        })
      : allClaims;

    const seenRestoredVehicles = new Set<string>();
    const finalClaims: typeof refreshedClaims = [];
    const duplicatesToDelete: string[] = [];

    for (const c of refreshedClaims) {
      if (c.timeline_step === "VEHICLE_BACK" && c.vehicle_id) {
        if (seenRestoredVehicles.has(c.vehicle_id)) {
          duplicatesToDelete.push(c.id);
          continue;
        }
        seenRestoredVehicles.add(c.vehicle_id);
      }
      finalClaims.push(c);
    }

    if (duplicatesToDelete.length > 0) {
      prisma.accidentClaim.deleteMany({
        where: { id: { in: duplicatesToDelete } },
      }).catch(() => {});
    }

    // Attach active or latest FieldTask for each claim
    const claimIds = finalClaims.map((c) => c.id);
    const fieldTasks = await prisma.fieldTask.findMany({
      where: {
        linked_ticket_id: { in: claimIds },
      },
      orderBy: { created_at: "desc" },
    });

    const fieldTasksByClaimId = new Map<string, (typeof fieldTasks)[0]>();
    for (const ft of fieldTasks) {
      if (ft.linked_ticket_id && !fieldTasksByClaimId.has(ft.linked_ticket_id)) {
        fieldTasksByClaimId.set(ft.linked_ticket_id, ft);
      }
    }

    const claimsWithTasks = finalClaims.map((claim) => ({
      ...claim,
      fieldTask: fieldTasksByClaimId.get(claim.id) || null,
    }));

    return NextResponse.json({ success: true, claims: claimsWithTasks });
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
