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

    const existingTask = await prisma.fieldTask.findUnique({ where: { id } });
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

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

    // Recovery Handover Checklist Fields
    if (body.has_key !== undefined) updateData.has_key = Boolean(body.has_key);
    if (body.has_carte_grise !== undefined) updateData.has_carte_grise = Boolean(body.has_carte_grise);
    if (body.has_assurance !== undefined) updateData.has_assurance = Boolean(body.has_assurance);
    if (body.recovery_notes !== undefined) updateData.recovery_notes = body.recovery_notes ? body.recovery_notes.trim() : null;

    // Calculate recovery turnaround time in hours
    if (body.status === "COMPLETED" && existingTask.task_type === "VEHICLE_RECOVERY") {
      const startMs = new Date(existingTask.created_at).getTime();
      const endMs = Date.now();
      const elapsedHours = Math.max(0.1, (endMs - startMs) / (1000 * 60 * 60));
      updateData.recovery_duration_hours = Number(elapsedHours.toFixed(1));
    }

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

      if (task.linked_ticket_id) {
        const claim = await prisma.accidentClaim.findUnique({ where: { id: task.linked_ticket_id } });
        if (claim) {
          await prisma.accidentClaim.update({
            where: { id: claim.id },
            data: { timeline_step: "VEHICLE_BACK", step_updated_at: new Date() }
          });
          await prisma.vehicle.update({
            where: { id: task.vehicle_id },
            data: { status: "Available" },
          });
        } else {
          await prisma.maintenanceTicket.update({
            where: { id: task.linked_ticket_id },
            data: { field_status: "COMPLETED" },
          }).catch((e) => console.warn("Failed to update ticket field_status:", e));
        }
      }
    }

    // When a VEHICLE_RECOVERY task is completed by the Field Supervisor:
    // 1. Restore vehicle to "Available" and unassign the driver
    // 2. Automatically close the linked MaintenanceTicket as RESOLVED with handover checklist notes
    if (body.status === "COMPLETED" && task.task_type === "VEHICLE_RECOVERY" && task.vehicle_id) {
      // Find current vehicle to log churn if driver was assigned
      const currentVehicle = await prisma.vehicle.findUnique({ where: { id: task.vehicle_id } });
      if (currentVehicle?.assigned_driver_name) {
        await prisma.churnEvent.create({
          data: {
            vehicle_id: task.vehicle_id,
            plate_number: currentVehicle.plate_number,
            driver_name: currentVehicle.assigned_driver_name,
            driver_phone: currentVehicle.assigned_driver_phone || "N/A",
            reason: `Vehicle Recovery by Field Supervisor (${task.recovery_notes || "Blocked vehicle retrieved"})`,
          },
        }).catch((e) => console.warn("Failed to log churn event on recovery:", e));
      }

      // Restore vehicle to Available
      await prisma.vehicle.update({
        where: { id: task.vehicle_id },
        data: {
          status: "Available",
          assigned_driver_name: null,
          assigned_driver_phone: null,
        },
      }).catch((e) => console.warn("Failed to restore vehicle on recovery:", e));

      // Auto-resolve linked Support/Maintenance ticket
      if (task.linked_ticket_id) {
        const checklistSummary = `[Handover Checklist: Key: ${task.has_key ? "✅ Yes" : "❌ No"}, Carte Grise: ${task.has_carte_grise ? "✅ Yes" : "❌ No"}, Assurance: ${task.has_assurance ? "✅ Yes" : "❌ No"}]`;
        const durationSummary = task.recovery_duration_hours ? `Turnaround Time: ${task.recovery_duration_hours}h.` : "";
        const notes = `Vehicle retrieved by Field Supervisor. ${durationSummary} ${checklistSummary} ${task.recovery_notes ? `Notes: ${task.recovery_notes}` : ""}`;

        await prisma.maintenanceTicket.update({
          where: { id: task.linked_ticket_id },
          data: {
            status: "RESOLVED",
            resolved_at: new Date(),
            field_status: "COMPLETED",
            resolution_notes: notes.trim(),
          },
        }).catch((e) => console.warn("Failed to auto-resolve ticket on recovery:", e));
      }
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
