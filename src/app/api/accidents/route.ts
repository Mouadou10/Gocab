import { NextResponse } from "next/server";
import { prisma, flushDatabaseSync } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { requireAuth } from "@/lib/api-auth";
import { getActiveRedFlagsLookup } from "@/lib/services/redFlagService";
import { notifyFleetManagerOfAccident } from "@/lib/services/fleetAccidentNotifyService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth().catch(() => null);
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
                id: "INSURANCE_DOSSIER_META",
                type: "INSURANCE_INFO",
                timeline_step: "INSURANCE_DOCS",
                claim_number: "",
                insurance_company: "Sanlam",
                garage_name: "Emergence",
                policy_number: v.insurance_policy_number || "",
                claim_status: "DECLARED",
                declaration_date: claimDate.toISOString().split("T")[0],
                expert_name: "",
                expert_phone: "",
                expertise_date: "",
                estimated_amount: 0,
                covered_amount: 0,
                franchise_amount: 0,
                payout_status: "PENDING",
                notes: [],
                updated_at: claimDate.toISOString(),
                updated_by: "Système",
              },
              {
                id: crypto.randomUUID(),
                timeline_step: "CAR_IN_GARAGE",
                comment: "Dossier maintenance synchronisé automatiquement depuis la flotte. Compagnie: Sanlam · Garage: Emergence",
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

    const redFlagsLookup = await getActiveRedFlagsLookup();

    const claimsWithTasks = finalClaims.map((claim) => {
      const flagCheck = redFlagsLookup.checkDriver({
        id: claim.driver_id || claim.driver?.id,
        name: claim.driver_name || claim.driver?.fullName,
        phone: claim.driver_phone || claim.driver?.phoneSanitized,
        cin: claim.driver?.cinNumber,
      });

      return {
        ...claim,
        is_driver_red_flagged: Boolean(claim.driver?.isRedFlagged || flagCheck.isRedFlagged),
        driver_red_flag_reason: claim.driver?.redFlagReason || flagCheck.reason,
        fieldTask: fieldTasksByClaimId.get(claim.id) || null,
      };
    });

    return NextResponse.json({ success: true, claims: claimsWithTasks });
  } catch (error: any) {
    console.error("Error fetching accident claims:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth().catch(() => null);
    let agentName = "Agent Assurance";
    if (authResult && "user" in authResult && authResult.user?.name) {
      agentName = authResult.user.name;
    }

    const body = await req.json().catch(() => ({}));
    const { vehicle_id, plate_number, driver_id, driver_name, driver_phone, severity, fault } = body;

    let targetVehicleId = vehicle_id;

    // Lookup vehicle by ID or plate number
    let vehicle = targetVehicleId
      ? await prisma.vehicle.findUnique({
          where: { id: targetVehicleId },
          include: { driverProfile: true },
        })
      : null;

    if (!vehicle && (plate_number || targetVehicleId)) {
      vehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { id: targetVehicleId || "" },
            { plate_number: (plate_number || targetVehicleId || "").trim() },
          ],
        },
        include: { driverProfile: true },
      });
      if (vehicle) {
        targetVehicleId = vehicle.id;
      }
    }

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Véhicule introuvable dans la flotte" },
        { status: 404 }
      );
    }

    const finalDriverName =
      driver_name || vehicle.assigned_driver_name || vehicle.driverProfile?.fullName || null;
    const finalDriverPhone =
      driver_phone || vehicle.assigned_driver_phone || vehicle.driverProfile?.phoneSanitized || null;
    const finalDriverId = driver_id || vehicle.driverProfile?.id || null;

    // Check if an active claim already exists for this vehicle so we reuse its ID cleanly
    const existingActiveClaim = await prisma.accidentClaim.findFirst({
      where: {
        vehicle_id: vehicle.id,
        timeline_step: { not: "VEHICLE_BACK" },
      },
      orderBy: { created_at: "desc" },
      include: {
        vehicle: true,
        driver: true,
      },
    });

    let claim = existingActiveClaim;

    if (!claim) {
      // Remove any old completed duplicate claims before opening the new active dossier
      await prisma.accidentClaim
        .deleteMany({
          where: {
            vehicle_id: vehicle.id,
            timeline_step: "VEHICLE_BACK",
          },
        })
        .catch(() => {});

      claim = await prisma.accidentClaim.create({
        data: {
          vehicle_id: vehicle.id,
          driver_id: finalDriverId,
          driver_name: finalDriverName,
          driver_phone: finalDriverPhone,
          severity: severity || "HARD",
          fault: fault || null,
          timeline_step: "NEW_ACCIDENT",
          comments: JSON.stringify([
            {
              id: "INSURANCE_DOSSIER_META",
              type: "INSURANCE_INFO",
              timeline_step: "INSURANCE_DOCS",
              claim_number: "",
              insurance_company: "Sanlam",
              garage_name: "Emergence",
              policy_number: vehicle.insurance_policy_number || "",
              claim_status: "DECLARED",
              declaration_date: new Date().toISOString().split("T")[0],
              expert_name: "",
              expert_phone: "",
              expertise_date: "",
              estimated_amount: 0,
              covered_amount: 0,
              franchise_amount: 0,
              payout_status: "PENDING",
              insurance_notes: [],
              updated_at: new Date().toISOString(),
              updated_by: agentName,
            },
            {
              id: crypto.randomUUID(),
              timeline_step: "NEW_ACCIDENT",
              comment: `Dossier accident ouvert par ${agentName} depuis la page Assurance. Compagnie: Sanlam · Garage: Emergence`,
              author: agentName,
              created_at: new Date().toISOString(),
            },
          ]),
        },
        include: {
          vehicle: true,
          driver: true,
        },
      });
    }

    // Update the vehicle's status to Accident
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: "Accident" },
    });

    // Ensure a Support ticket exists
    const existingTicket = await prisma.maintenanceTicket.findFirst({
      where: {
        vehicle_id: vehicle.id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    });

    if (!existingTicket) {
      await prisma.maintenanceTicket.create({
        data: {
          vehicle_id: vehicle.id,
          plate_number: vehicle.plate_number,
          driver_name: finalDriverName,
          driver_phone: finalDriverPhone,
          ticket_type: "Accident",
          priority: "Urgent",
          status: "OPEN",
          description: `💥 Véhicule signalé en accident depuis la page Assurance par ${agentName}. Réparation mécanique requise.`,
          sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }).catch((e: any) => console.warn("Could not create support ticket:", e));
    }

    // Automatically notify the owning Fleet Manager (Mohamed Aziz or Mehdi Elyattouti) on WhatsApp
    // with interactive button "[✅ Créé sur Fleet]" + 1-click confirmation link
    let notifyResult: any = null;
    try {
      notifyResult = await notifyFleetManagerOfAccident({
        claimId: claim.id,
        vehicle,
        driverName: finalDriverName,
        driverPhone: finalDriverPhone,
        reportedBy: agentName,
        requestUrl: req.url,
      });
    } catch (notifyErr: any) {
      console.error("Error in notifyFleetManagerOfAccident:", notifyErr);
    }

    // Touch sync state so Insurance, Tickets, and WhatsApp pages immediately refresh
    await touchSyncState("tickets").catch(() => {});
    await touchSyncState("all").catch(() => {});
    await flushDatabaseSync().catch(() => {});

    return NextResponse.json({
      success: true,
      claim: notifyResult?.claim || claim,
      whatsappNotification: {
        sent: Boolean(notifyResult?.success),
        managerName: notifyResult?.manager?.name || vehicle.assigned_supervisor || "Mohamed Aziz",
        managerPhone: notifyResult?.targetPhone || "",
        windowOpen24h: Boolean(notifyResult?.windowOpen24h),
        waMeFallbackUrl: notifyResult?.waMeFallbackUrl || null,
        confirmUrl: notifyResult?.confirmUrl || null,
        error: notifyResult?.whatsappError || null,
      },
    });
  } catch (error: any) {
    console.error("Error creating accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
