import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";

/**
 * PATCH /api/tickets/[id]
 * Updates ticket details, status, waiver fields.
 * On RESOLVED: auto-creates a FieldTask (GARAGE_PICKUP) and sets field_status.
 * Vehicle status is NOT restored here — the Field Supervisor handles that.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const currentTicket = await prisma.maintenanceTicket.findUnique({ where: { id } });
    if (!currentTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const updateData: any = {};

    // 1. Accident Ticket Step Synchronization
    if (body.accident_step !== undefined) {
      // Look up and update the linked/active AccidentClaim
      const claim = await prisma.accidentClaim.findFirst({
        where: { vehicle_id: currentTicket.vehicle_id },
        orderBy: { created_at: "desc" },
      });

      if (claim) {
        await prisma.accidentClaim.update({
          where: { id: claim.id },
          data: {
            timeline_step: body.accident_step,
            step_updated_at: new Date(),
          },
        });
      }

      // If changed from the initial one (NEW_ACCIDENT) to any repair step -> vehicle is IN_PROGRESS
      if (body.accident_step === "VEHICLE_BACK") {
        updateData.status = "RESOLVED";
        updateData.resolved_at = new Date();
        updateData.field_status = "READY_FOR_PICKUP";
      } else if (body.accident_step === "NEW_ACCIDENT") {
        updateData.status = "OPEN";
        updateData.resolved_at = null;
        updateData.field_status = null;
      } else {
        // Any intermediate step (CAR_IN_GARAGE, STARTING_REPAIR, INSURANCE_DOCS, READY_FOR_PICKUP) means IN_PROGRESS
        updateData.status = "IN_PROGRESS";
        updateData.resolved_at = null;
        updateData.field_status = null;
      }
    } else if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "RESOLVED") {
        updateData.resolved_at = new Date();
        updateData.field_status = "READY_FOR_PICKUP";
      } else if (body.status === "OPEN" || body.status === "IN_PROGRESS") {
        updateData.resolved_at = null;
        updateData.field_status = null;
      }

      // If this is an accident ticket, also sync the AccidentClaim step
      if (currentTicket.ticket_type === "Accident") {
        const claim = await prisma.accidentClaim.findFirst({
          where: { vehicle_id: currentTicket.vehicle_id },
          orderBy: { created_at: "desc" },
        });

        if (claim) {
          let targetStep = claim.timeline_step;
          if (body.status === "IN_PROGRESS" && claim.timeline_step === "NEW_ACCIDENT") {
            targetStep = "CAR_IN_GARAGE";
          } else if (body.status === "RESOLVED" && claim.timeline_step !== "VEHICLE_BACK") {
            targetStep = "VEHICLE_BACK";
          } else if (body.status === "OPEN" && claim.timeline_step !== "NEW_ACCIDENT") {
            targetStep = "NEW_ACCIDENT";
          }

          if (targetStep !== claim.timeline_step) {
            await prisma.accidentClaim.update({
              where: { id: claim.id },
              data: { timeline_step: targetStep, step_updated_at: new Date() },
            });
          }
        }
      }
    }

    if (body.started_at !== undefined) {
      updateData.started_at = body.started_at ? new Date(body.started_at) : null;
      if (body.started_at && !body.status && currentTicket.status === "OPEN") {
        updateData.status = "IN_PROGRESS";
      }
    }

    if (body.field_status !== undefined) updateData.field_status = body.field_status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.driver_name !== undefined) updateData.driver_name = body.driver_name;
    if (body.driver_phone !== undefined) updateData.driver_phone = body.driver_phone;

    // Fleet Performance Payment Waiver attributes
    if (body.payment_waived !== undefined) updateData.payment_waived = Boolean(body.payment_waived);
    if (body.waived_days !== undefined) updateData.waived_days = Number(body.waived_days);
    if (body.waiver_reason !== undefined) updateData.waiver_reason = body.waiver_reason ? body.waiver_reason.trim() : null;

    // Repair tracking attributes
    if (body.repair_cost !== undefined) updateData.repair_cost = body.repair_cost !== null ? Number(body.repair_cost) : null;
    if (body.garage_name !== undefined) updateData.garage_name = body.garage_name;
    if (body.resolution_notes !== undefined) updateData.resolution_notes = body.resolution_notes;

    const ticket = await prisma.maintenanceTicket.update({
      where: { id },
      data: updateData,
    });

    // Auto-sync Financial Expense from Bon de Commande / Repair Cost
    if (updateData.resolution_notes !== undefined || updateData.repair_cost !== undefined) {
      try {
        let parsedBc: any = null;
        const notesStr = updateData.resolution_notes !== undefined ? updateData.resolution_notes : ticket.resolution_notes;
        if (notesStr) {
          try {
            const p = JSON.parse(notesStr);
            if (p && p.bon_de_commande) parsedBc = p.bon_de_commande;
          } catch {}
        }
        const costAmount = parsedBc?.total_ttc || (ticket.repair_cost !== null && ticket.repair_cost !== undefined ? Number(ticket.repair_cost) : 0);
        if (costAmount > 0 && ticket.vehicle_id) {
          const bcRef = parsedBc?.bc_number ? String(parsedBc.bc_number) : `BC-TICK-${ticket.id.slice(0, 8).toUpperCase()}`;
          const isVidange =
            ticket.ticket_type === "Vidange" ||
            ticket.ticket_type === "AdBleu" ||
            (parsedBc?.items && parsedBc.items.some((it: any) => (it.designation || "").toLowerCase().includes("vidange")));
          const category = isVidange ? "MAINTENANCE" : (ticket.ticket_type === "Accident" ? "ACCIDENT" : "REPAIR");
          const itemsSummary = parsedBc?.items && parsedBc.items.length > 0
            ? parsedBc.items.map((i: any) => `${i.designation || "Prestation"} (x${i.quantity || 1})`).join(", ")
            : ticket.description;

          const existingExpense = await prisma.vehicleExpense.findFirst({
            where: {
              OR: [
                { invoice_number: bcRef },
                { description: { contains: ticket.id.slice(0, 8) } }
              ],
              vehicle_id: ticket.vehicle_id,
            },
          });

          if (existingExpense) {
            await prisma.vehicleExpense.update({
              where: { id: existingExpense.id },
              data: {
                amount_mad: costAmount,
                description: `[Bon de Commande ${bcRef}] ${itemsSummary} · Fournisseur: ${parsedBc?.supplier_name || ticket.garage_name || "Hard Auto Services"}`,
                invoice_number: bcRef,
                category,
              },
            });
          } else {
            await prisma.vehicleExpense.create({
              data: {
                vehicle_id: ticket.vehicle_id,
                plate_number: ticket.plate_number,
                category,
                amount_mad: costAmount,
                description: `[Bon de Commande ${bcRef}] ${itemsSummary} · Fournisseur: ${parsedBc?.supplier_name || ticket.garage_name || "Hard Auto Services"}`,
                invoice_number: bcRef,
                paid_by: "COMPANY",
                status: "PAID",
                paid_at: parsedBc?.date ? new Date(parsedBc.date) : new Date(),
              },
            });
          }
        }
      } catch (expErr) {
        console.warn("Error syncing VehicleExpense on PATCH ticket:", expErr);
      }
    }

    // Touch sync state so all open sessions refresh immediately
    touchSyncState("tickets").catch(() => {});

    // When ticket transitions to resolved, auto-update or create Field Task for Field Supervisor
    if (updateData.status === "RESOLVED" && currentTicket.status !== "RESOLVED") {
      const isRecovery = 
        ticket.ticket_type === "VEHICLE_RECOVERY" || 
        ticket.ticket_type.includes("Recovery") || 
        ticket.ticket_type.includes("Blocage") ||
        ticket.ticket_type.includes("Blocked");

      if (isRecovery) {
        // Complete the linked recovery FieldTask
        await prisma.fieldTask.updateMany({
          where: {
            OR: [
              { linked_ticket_id: ticket.id },
              { vehicle_id: ticket.vehicle_id, task_type: "VEHICLE_RECOVERY", status: { not: "COMPLETED" } }
            ]
          },
          data: {
            status: "COMPLETED",
            completed_at: new Date(),
          }
        }).catch((e) => console.warn("Failed to mark recovery field task completed:", e));
      } else {
        await prisma.fieldTask.create({
          data: {
            task_type: "GARAGE_PICKUP",
            vehicle_id: ticket.vehicle_id,
            plate_number: ticket.plate_number,
            driver_name: ticket.driver_name,
            driver_phone: ticket.driver_phone,
            description: `Garage pickup: ${ticket.ticket_type} completed for ${ticket.plate_number}. ${ticket.description}`,
            priority: ticket.priority,
            linked_ticket_id: ticket.id,
          },
        }).catch((e) => console.warn("Failed to create field task on ticket resolution:", e));
      }

      // Calculate downtime and update vehicle
      const now = new Date();
      const startTime = (ticket.started_at ? new Date(ticket.started_at) : ticket.created_at).getTime();
      const downtimeDays = Math.max(1, Math.ceil((now.getTime() - startTime) / (1000 * 3600 * 24)));
      await prisma.vehicle.update({
        where: { id: ticket.vehicle_id },
        data: {
          total_downtime_days: { increment: downtimeDays }
        }
      }).catch((e) => console.warn("Failed to update vehicle downtime:", e));
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("PATCH /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

/**
 * DELETE /api/tickets/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ticket = await prisma.maintenanceTicket.findUnique({ where: { id } });
    if (ticket) {
      // 1. Delete any linked FieldTasks
      await prisma.fieldTask.deleteMany({
        where: {
          OR: [
            { linked_ticket_id: id },
            { plate_number: ticket.plate_number, task_type: "VEHICLE_RECOVERY" }
          ]
        }
      }).catch((e) => console.warn("Failed to delete linked field tasks on ticket delete:", e));

      // 2. If recovery ticket set vehicle to Blocked, restore vehicle to Actif
      if (ticket.ticket_type === "VEHICLE_RECOVERY" || ticket.ticket_type.includes("Recovery") || ticket.ticket_type.includes("Blocage")) {
        await prisma.vehicle.update({
          where: { id: ticket.vehicle_id },
          data: { status: "Actif" }
        }).catch(() => {});
      }

      // 3. Delete the ticket
      await prisma.maintenanceTicket.delete({ where: { id } });
    }

    touchSyncState("tickets").catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete ticket" },
      { status: 500 }
    );
  }
}
