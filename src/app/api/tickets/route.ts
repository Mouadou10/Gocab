import { NextResponse } from "next/server";
import { prisma, flushDatabaseSync } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { sendFieldTaskTelegramAlert } from "@/lib/services/telegramService";
import { requireAuth } from "@/lib/api-auth";
import { getActiveRedFlagsLookup } from "@/lib/services/redFlagService";
import {
  extractFleetSyncFromComments,
  notifyFleetManagerOfAccident,
  resolveFleetManagerContactForVehicle,
} from "@/lib/services/fleetAccidentNotifyService";

export const dynamic = "force-dynamic";

/**
 * GET /api/tickets
 * Fetches all maintenance and support tickets with optional filtering.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";

    // Ensure any active VEHICLE_RECOVERY FieldTask created from Collections/Terrain is mirrored and active on the Ticket Page
    try {
      const activeRecoveryTasks = await prisma.fieldTask.findMany({
        where: {
          task_type: "VEHICLE_RECOVERY",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      });

      for (const ft of activeRecoveryTasks) {
        if (!ft.linked_ticket_id) {
          const slaDeadline = new Date(new Date(ft.created_at).getTime() + 24 * 60 * 60 * 1000);
          const createdTicket = await prisma.maintenanceTicket.create({
            data: {
              vehicle_id: ft.vehicle_id || "UNASSIGNED",
              plate_number: ft.plate_number || "Véhicule non assigné",
              driver_name: ft.driver_name,
              driver_phone: ft.driver_phone,
              ticket_type: "VEHICLE_RECOVERY",
              description: ft.description || "Véhicule bloqué / Récupération terrain",
              priority: ft.priority || "Critical",
              status: ft.status === "IN_PROGRESS" ? "IN_PROGRESS" : "OPEN",
              sla_deadline: slaDeadline,
              is_archived: false,
              created_at: ft.created_at,
            },
          }).catch(() => null);

          if (createdTicket) {
            await prisma.fieldTask.update({
              where: { id: ft.id },
              data: { linked_ticket_id: createdTicket.id },
            }).catch(() => {});
          }
        } else {
          // If the linked ticket exists but was prematurely marked RESOLVED while the field mission is still active
          const linkedTicket = await prisma.maintenanceTicket.findUnique({
            where: { id: ft.linked_ticket_id },
          }).catch(() => null);

          if (linkedTicket && linkedTicket.status === "RESOLVED") {
            await prisma.maintenanceTicket.update({
              where: { id: linkedTicket.id },
              data: {
                status: ft.status === "IN_PROGRESS" ? "IN_PROGRESS" : "OPEN",
                resolved_at: null,
                resolution_notes: null,
                is_archived: false,
              },
            }).catch(() => {});
          }
        }
      }
    } catch {}

    const where: any = {};

    if (search) {
      where.OR = [
        { plate_number: { contains: search } },
        { driver_name: { contains: search } },
        { driver_phone: { contains: search } },
        { description: { contains: search } },
        { garage_name: { contains: search } },
        { resolution_notes: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      if (type === "VEHICLE_RECOVERY" || type === "Vehicle Recovery") {
        where.ticket_type = { in: ["VEHICLE_RECOVERY", "Vehicle Recovery"] };
      } else {
        where.ticket_type = type;
      }
    }

    const tickets = await prisma.maintenanceTicket.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    // For accident tickets, fetch active AccidentClaim timeline step
    const accidentVehicleIds = tickets
      .filter((t) => t.ticket_type === "Accident")
      .map((t) => t.vehicle_id);

    let accidentClaimsMap: Record<string, any> = {};
    if (accidentVehicleIds.length > 0) {
      const claims = await prisma.accidentClaim.findMany({
        where: {
          vehicle_id: { in: accidentVehicleIds },
        },
        orderBy: { created_at: "desc" },
      });
      for (const claim of claims) {
        if (!accidentClaimsMap[claim.vehicle_id]) {
          accidentClaimsMap[claim.vehicle_id] = claim;
        }
      }
    }

    const redFlagsLookup = await getActiveRedFlagsLookup();

    const enrichedTickets = tickets.map((t) => {
      const flagCheck = redFlagsLookup.checkDriver({
        name: t.driver_name,
        phone: t.driver_phone,
      });

      let extra: any = {
        is_driver_red_flagged: flagCheck.isRedFlagged,
        driver_red_flag_reason: flagCheck.reason,
      };

      if (t.ticket_type === "Accident") {
        const claim = accidentClaimsMap[t.vehicle_id];
        const claimStep =
          claim?.timeline_step ||
          (t.status === "RESOLVED"
            ? "VEHICLE_BACK"
            : t.status === "IN_PROGRESS"
            ? "CAR_IN_GARAGE"
            : "NEW_ACCIDENT");

        let effectiveStatus = t.status;
        if (claimStep === "VEHICLE_BACK" || t.status === "RESOLVED") {
          effectiveStatus = "RESOLVED";
        } else if (claimStep === "NEW_ACCIDENT") {
          effectiveStatus = "OPEN";
        } else {
          // CAR_IN_GARAGE, STARTING_REPAIR, INSURANCE_DOCS, READY_FOR_PICKUP
          effectiveStatus = "IN_PROGRESS";
        }

        const fleetSync = extractFleetSyncFromComments(claim?.comments);
        const defaultMgr = resolveFleetManagerContactForVehicle({
          plate_number: t.plate_number,
        });

        return {
          ...t,
          ...extra,
          status: effectiveStatus,
          accident_claim_id: claim?.id || null,
          accident_step: claimStep,
          fleet_manager_name: fleetSync.fleet_manager_name || defaultMgr.name,
          fleet_whatsapp_notified: Boolean(fleetSync.fleet_whatsapp_notified),
          fleet_created_on_gocab_fleet: Boolean(fleetSync.fleet_created_on_gocab_fleet),
          fleet_created_at: fleetSync.fleet_created_at || null,
          fleet_created_by: fleetSync.fleet_created_by || null,
        };
      }
      return {
        ...t,
        ...extra,
      };
    });

    return NextResponse.json({ tickets: enrichedTickets });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets
 * Creates a new maintenance/support ticket and optionally updates vehicle status to "In garage" or "Accident".
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const body = await request.json().catch(() => ({}));

    const {
      vehicle_id,
      plate_number,
      driver_name,
      driver_phone,
      ticket_type,
      description,
      priority,
      update_vehicle_status,
      started_at,
      repair_cost,
      garage_name,
      resolution_notes,
      assigned_to,
      scheduled_date,
      scheduled_time,
      duration_hours,
    } = body;

    let cleanPlate = plate_number ? String(plate_number).trim() : "";
    let cleanVehicleId = vehicle_id ? String(vehicle_id).trim() : "";

    if (!cleanVehicleId && cleanPlate) {
      const v = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { plate_number: cleanPlate },
            { plate_number: { contains: cleanPlate } },
          ],
        },
      }).catch(() => null);
      if (v) {
        cleanVehicleId = v.id;
        cleanPlate = v.plate_number;
      } else {
        cleanVehicleId = "UNASSIGNED";
      }
    } else if (cleanVehicleId && !cleanPlate) {
      const v = await prisma.vehicle.findUnique({
        where: { id: cleanVehicleId },
      }).catch(() => null);
      if (v) {
        cleanPlate = v.plate_number;
      } else {
        cleanPlate = "Véhicule non assigné";
      }
    }

    if (!cleanPlate && !cleanVehicleId) {
      return NextResponse.json(
        { error: "Veuillez spécifier un véhicule ou un matricule d'immatriculation." },
        { status: 400 }
      );
    }

    if (!ticket_type || !description) {
      return NextResponse.json(
        { error: "Le type de ticket et la description sont obligatoires." },
        { status: 400 }
      );
    }

    const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        vehicle_id: cleanVehicleId || "UNASSIGNED",
        plate_number: cleanPlate || "Véhicule non assigné",
        driver_name: driver_name ? driver_name.trim() : null,
        driver_phone: driver_phone ? driver_phone.trim() : null,
        ticket_type: ticket_type.trim(),
        description: description.trim(),
        priority: priority || "Normal",
        status: started_at ? "IN_PROGRESS" : "OPEN",
        started_at: started_at && !isNaN(new Date(started_at).getTime()) ? new Date(started_at) : null,
        sla_deadline: slaDeadline,
        repair_cost: repair_cost !== undefined && repair_cost !== null && !isNaN(Number(repair_cost)) ? Number(repair_cost) : null,
        garage_name: garage_name ? String(garage_name).trim() : null,
        resolution_notes: resolution_notes ? String(resolution_notes) : null,
      },
    });

    // Auto-record Financial Expense from Bon de Commande / Repair Cost to track per-car spending
    try {
      let parsedBc: any = null;
      if (resolution_notes) {
        try {
          const parsed = JSON.parse(resolution_notes);
          if (parsed && parsed.bon_de_commande) {
            parsedBc = parsed.bon_de_commande;
          }
        } catch {}
      }

      const costAmount = parsedBc?.total_ttc || (repair_cost !== undefined && repair_cost !== null ? Number(repair_cost) : 0);
      if (costAmount > 0) {
        const isVidangeOrMaintenance =
          ticket_type === "Vidange" ||
          ticket_type === "AdBleu" ||
          (parsedBc?.items && parsedBc.items.some((it: any) => (it.designation || "").toLowerCase().includes("vidange")));

        const expenseCategory = isVidangeOrMaintenance
          ? "MAINTENANCE"
          : ticket_type === "Accident"
          ? "ACCIDENT"
          : "REPAIR";

        const itemsSummary = parsedBc?.items && parsedBc.items.length > 0
          ? parsedBc.items.map((i: any) => `${i.designation || "Prestation"} (x${i.quantity || 1})`).join(", ")
          : description;

        const bcRef = parsedBc?.bc_number ? String(parsedBc.bc_number) : `BC-TICK-${ticket.id.slice(0, 8).toUpperCase()}`;

        const linkedVehicle = await prisma.vehicle.findFirst({
          where: {
            OR: [
              { id: vehicle_id },
              { plate_number: plate_number.trim() },
            ],
          },
        });

        if (linkedVehicle) {
          await prisma.vehicleExpense.create({
            data: {
              vehicle_id: linkedVehicle.id,
              plate_number: linkedVehicle.plate_number,
              category: expenseCategory,
              amount_mad: Number(costAmount),
              description: `[Bon de Commande ${bcRef}] ${itemsSummary} · Fournisseur: ${parsedBc?.supplier_name || garage_name || "Hard Auto Services"}`,
              invoice_number: bcRef,
              paid_by: "COMPANY",
              status: "PAID",
              paid_at: parsedBc?.date ? new Date(parsedBc.date) : new Date(),
            },
          });
        }
      }
    } catch (expErr) {
      console.warn("Auto-creating VehicleExpense from ticket Bon de Commande warning:", expErr);
    }

    // Auto-update vehicle status and dispatch linked tasks based on ticket type
    const isRecoveryTicket = 
      ticket_type === "VEHICLE_RECOVERY" || 
      ticket_type.includes("Recovery") || 
      ticket_type.includes("Blocage") ||
      ticket_type.includes("Blocked");

    if (isRecoveryTicket) {
      // Set vehicle status to Blocked
      await prisma.vehicle.update({
        where: { id: vehicle_id },
        data: { status: "Blocked" },
      }).catch((e) => console.warn("Failed to set vehicle to Blocked:", e));

      // Auto-dispatch VEHICLE_RECOVERY FieldTask for Field Supervisors
      try {
        const fieldTask = await prisma.fieldTask.create({
          data: {
            task_type: "VEHICLE_RECOVERY",
            vehicle_id: vehicle_id || null,
            plate_number: plate_number ? plate_number.trim() : null,
            driver_name: driver_name ? driver_name.trim() : null,
            driver_phone: driver_phone ? driver_phone.trim() : null,
            description: description.trim(),
            priority: priority || "Critical",
            status: "PENDING",
            linked_ticket_id: ticket.id,
            assigned_to: assigned_to ? assigned_to.trim() : null,
            scheduled_date: scheduled_date ? scheduled_date.trim() : null,
            scheduled_time: scheduled_time ? scheduled_time.trim() : null,
            duration_hours: duration_hours ? Number(duration_hours) : 1.0,
          },
        });

        // Send instant Telegram notification to the Field Supervisor group (asynchronous)
        sendFieldTaskTelegramAlert({
          ...fieldTask,
          triggered_by: "Support / Performance Ticket",
        }).catch((err) =>
          console.error("Non-blocking Telegram alert error:", err)
        );
      } catch (ftErr) {
        console.warn("Failed to auto-create recovery FieldTask:", ftErr);
      }
    } else if (update_vehicle_status) {
      let targetStatus = "Actif";
      if (ticket_type === "Accident") {
        targetStatus = "Accident";
      } else {
        targetStatus = "Actif";
      }
      
      if (cleanVehicleId && cleanVehicleId !== "UNASSIGNED") {
        await prisma.vehicle
          .update({
            where: { id: cleanVehicleId },
            data: { status: targetStatus },
          })
          .catch((e) => console.warn("Failed to update vehicle status on ticket creation:", e));
      }
    }

    let whatsappNotification: any = null;

    if (ticket_type === "Accident" && cleanVehicleId && cleanVehicleId !== "UNASSIGNED") {
      const targetVehicle = await prisma.vehicle
        .findUnique({
          where: { id: cleanVehicleId },
          include: { driverProfile: true },
        })
        .catch(() => null);

      let activeClaim = await prisma.accidentClaim.findFirst({
        where: {
          vehicle_id: cleanVehicleId,
          timeline_step: { not: "VEHICLE_BACK" },
        },
        orderBy: { created_at: "desc" },
      });

      const agentName = authResult.user.name || "Agent Support";

      if (!activeClaim && targetVehicle) {
        await prisma.accidentClaim
          .deleteMany({
            where: {
              vehicle_id: cleanVehicleId,
              timeline_step: "VEHICLE_BACK",
            },
          })
          .catch(() => {});

        activeClaim = await prisma.accidentClaim.create({
          data: {
            vehicle_id: cleanVehicleId,
            driver_id: targetVehicle.driverProfile?.id || null,
            driver_name: driver_name
              ? driver_name.trim()
              : targetVehicle.assigned_driver_name || targetVehicle.driverProfile?.fullName || null,
            driver_phone: driver_phone
              ? driver_phone.trim()
              : targetVehicle.assigned_driver_phone ||
                targetVehicle.driverProfile?.phoneSanitized ||
                null,
            severity: "HARD",
            timeline_step: "NEW_ACCIDENT",
            comments: JSON.stringify([
              {
                id: "INSURANCE_DOSSIER_META",
                type: "INSURANCE_INFO",
                timeline_step: "INSURANCE_DOCS",
                claim_number: "",
                insurance_company: "Sanlam",
                garage_name: garage_name ? String(garage_name).trim() : "Emergence",
                policy_number: targetVehicle.insurance_policy_number || "",
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
                comment: `Dossier accident ouvert depuis Support Tickets par ${agentName}. ${description.trim()}`,
                author: agentName,
                created_at: new Date().toISOString(),
              },
            ]),
          },
        });
      }

      if (activeClaim && targetVehicle) {
        const existingSync = extractFleetSyncFromComments(activeClaim.comments);
        if (!existingSync.fleet_whatsapp_notified) {
          const notifyRes = await notifyFleetManagerOfAccident({
            claimId: activeClaim.id,
            vehicle: targetVehicle,
            driverName:
              (driver_name ? driver_name.trim() : null) ||
              activeClaim.driver_name ||
              targetVehicle.assigned_driver_name,
            driverPhone:
              (driver_phone ? driver_phone.trim() : null) ||
              activeClaim.driver_phone ||
              targetVehicle.assigned_driver_phone,
            reportedBy: agentName,
            requestUrl: request.url,
          });
          whatsappNotification = {
            sent: notifyRes.success,
            managerName: notifyRes.manager.name,
            managerPhone: notifyRes.targetPhone,
            windowOpen24h: notifyRes.windowOpen24h,
            waMeFallbackUrl: notifyRes.waMeFallbackUrl,
          };
        }
      }
    }

    // Touch sync state so all open sessions refresh immediately
    await touchSyncState("tickets").catch(() => {});
    await touchSyncState("all").catch(() => {});
    await flushDatabaseSync().catch(() => {});

    return NextResponse.json({ ticket, whatsappNotification }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tickets error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create ticket" },
      { status: 500 }
    );
  }
}
