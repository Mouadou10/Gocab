import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/field-tasks/[id]
 * Updates task status. When COMPLETED for GARAGE_PICKUP, auto-restores vehicle to Actif.
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
      if (body.status === "COMPLETED" || body.status === "FAILED") {
        updateData.completed_at = new Date();
      }
    }
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.due_date !== undefined) updateData.due_date = body.due_date ? new Date(body.due_date) : null;
    if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to ? body.assigned_to.trim() : null;
    if (body.failure_reason !== undefined) updateData.failure_reason = body.failure_reason ? body.failure_reason.trim() : null;

    const task = await prisma.fieldTask.update({
      where: { id },
      data: updateData,
    });

    // When a GARAGE_PICKUP task is completed, restore vehicle to Actif
    if (body.status === "COMPLETED" && task.task_type === "GARAGE_PICKUP" && task.vehicle_id) {
      await prisma.vehicle.update({
        where: { id: task.vehicle_id },
        data: { status: "Actif" },
      }).catch((e) => console.warn("Failed to restore vehicle on field task completion:", e));

      // Also update the linked ticket's field_status to COMPLETED
      // Check if the linked ticket is an AccidentClaim first
      if (task.linked_ticket_id) {
        const claim = await prisma.accidentClaim.findUnique({ where: { id: task.linked_ticket_id } });
        if (claim) {
          await prisma.accidentClaim.update({
            where: { id: claim.id },
            data: { timeline_step: "VEHICLE_BACK", step_updated_at: new Date() }
          });
          // Also set vehicle to Available since it's back from accident
          await prisma.vehicle.update({
            where: { id: task.vehicle_id },
            data: { status: "Available" },
          });
        } else {
          // If not an accident claim, assume it's a MaintenanceTicket
          await prisma.maintenanceTicket.update({
            where: { id: task.linked_ticket_id },
            data: { field_status: "COMPLETED" },
          }).catch((e) => console.warn("Failed to update ticket field_status:", e));
        }
      }
    }

    // When a VEHICLE_RECOVERY task is completed, restore vehicle to Available
    if (body.status === "COMPLETED" && task.task_type === "VEHICLE_RECOVERY" && task.vehicle_id) {
      await prisma.vehicle.update({
        where: { id: task.vehicle_id },
        data: { status: "Available" },
      }).catch((e) => console.warn("Failed to restore vehicle on recovery:", e));
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("PATCH /api/field-tasks/[id] error:", error);
    return NextResponse.json({ error: "Failed to update field task" }, { status: 500 });
  }
}

/**
 * DELETE /api/field-tasks/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.fieldTask.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/field-tasks/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete field task" }, { status: 500 });
  }
}
