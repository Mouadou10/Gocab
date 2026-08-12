import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const updateData: any = {};

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "RESOLVED") {
        updateData.resolved_at = new Date();
        updateData.field_status = "READY_FOR_PICKUP";
      } else if (body.status === "OPEN" || body.status === "IN_PROGRESS") {
        updateData.resolved_at = null;
        updateData.field_status = null;
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

    // When ticket is resolved, auto-create a Field Task for the Field Supervisor
    if (body.status === "RESOLVED") {
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

      // Calculate downtime and update vehicle
      const now = new Date();
      const downtimeDays = Math.max(1, Math.ceil((now.getTime() - ticket.created_at.getTime()) / (1000 * 3600 * 24)));
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

/**
 * DELETE /api/tickets/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.maintenanceTicket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete ticket" },
      { status: 500 }
    );
  }
}
