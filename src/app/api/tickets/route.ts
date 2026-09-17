import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";

/**
 * GET /api/tickets
 * Fetches all maintenance and support tickets with optional filtering.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";

    const where: any = {};

    if (search) {
      where.OR = [
        { plate_number: { contains: search } },
        { driver_name: { contains: search } },
        { driver_phone: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.ticket_type = type;
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

    const enrichedTickets = tickets.map((t) => {
      if (t.ticket_type === "Accident" && accidentClaimsMap[t.vehicle_id]) {
        return {
          ...t,
          accident_claim_id: accidentClaimsMap[t.vehicle_id].id,
          accident_step: accidentClaimsMap[t.vehicle_id].timeline_step,
        };
      }
      return t;
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
    const body = await request.json();

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
    } = body;

    if (!vehicle_id || !plate_number || !ticket_type || !description) {
      return NextResponse.json(
        { error: "Vehicle, Plate Number, Ticket Type, and Description are required." },
        { status: 400 }
      );
    }

    const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        vehicle_id,
        plate_number: plate_number.trim(),
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
      // Set vehicle status to Blocked if requested.
      // Vehicle recovery FieldTask is only created manually by performance agent from collection page.
      await prisma.vehicle.update({
        where: { id: vehicle_id },
        data: { status: "Blocked" },
      }).catch((e) => console.warn("Failed to set vehicle to Blocked:", e));
    } else if (update_vehicle_status) {
      let targetStatus = "Actif";
      if (ticket_type === "Accident") {
        targetStatus = "Accident";
      } else {
        targetStatus = "Actif";
      }
      
      await prisma.vehicle.update({
        where: { id: vehicle_id },
        data: { status: targetStatus },
      }).catch((e) => console.warn("Failed to update vehicle status on ticket creation:", e));
    }

    if (ticket_type === "Accident") {
      const activeClaim = await prisma.accidentClaim.findFirst({
        where: { 
          vehicle_id,
          timeline_step: { not: "VEHICLE_BACK" }
        }
      });
      if (!activeClaim) {
        await prisma.accidentClaim.create({
          data: {
            vehicle_id,
            driver_name: driver_name ? driver_name.trim() : null,
            driver_phone: driver_phone ? driver_phone.trim() : null,
          }
        });
      }
    }

    // Touch sync state so all open sessions refresh immediately
    touchSyncState("tickets").catch(() => {});

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tickets error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create ticket" },
      { status: 500 }
    );
  }
}
