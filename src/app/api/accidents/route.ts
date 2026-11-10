import { NextResponse } from "next/server";
import { prisma, flushDatabaseSync, ensureDatabaseSynced } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { requireAuth } from "@/lib/api-auth";
import { getActiveRedFlagsLookup } from "@/lib/services/redFlagService";
import { notifyFleetManagerOfAccident } from "@/lib/services/fleetAccidentNotifyService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Parallelize all queries concurrently for ultra-fast response
    const [allClaims, fieldTasks, redFlagsLookup] = await Promise.all([
      prisma.accidentClaim.findMany({
        include: {
          vehicle: true,
          driver: {
            select: {
              id: true,
              fullName: true,
              phoneSanitized: true,
              cinNumber: true,
              isRedFlagged: true,
              redFlagReason: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.fieldTask.findMany({
        where: {
          linked_ticket_id: { not: null },
        },
        orderBy: { created_at: "desc" },
        take: 200,
      }),
      getActiveRedFlagsLookup(),
    ]);

    const fieldTasksByClaimId = new Map<string, (typeof fieldTasks)[0]>();
    for (const ft of fieldTasks) {
      if (ft.linked_ticket_id && !fieldTasksByClaimId.has(ft.linked_ticket_id)) {
        fieldTasksByClaimId.set(ft.linked_ticket_id, ft);
      }
    }

    const claimsWithTasks = allClaims.map((claim) => {
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

    return NextResponse.json(
      { success: true, claims: claimsWithTasks },
      {
        headers: {
          "Cache-Control": "private, no-cache, stale-while-revalidate=30",
        },
      }
    );
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
