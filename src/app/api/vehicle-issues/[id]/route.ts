import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { sendVehicleIssueTelegramAlert } from "@/lib/services/telegramService";

export const dynamic = "force-dynamic";

/**
 * GET /api/vehicle-issues/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const issue = await prisma.vehicleIssue.findUnique({
      where: { id },
    });

    if (!issue) {
      return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 });
    }

    return NextResponse.json({ issue });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/vehicle-issues/[id]
 * Handles:
 * 1. ASSIGN — Fleet performance assigns the ticket to himself/herself
 * 2. SOLVE — Agent marks the problem as solved
 * 3. TRANSFORM_SUPPORT_TICKET — Transform issue into formal Support/Maintenance ticket
 * 4. TRANSFER_FIELD_SUPERVISOR — Create FieldTask & send Telegram alert
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action;

    const existingIssue = await prisma.vehicleIssue.findUnique({
      where: { id },
    });

    if (!existingIssue) {
      return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 });
    }

    // 1. ACTION: ASSIGN (Only accessible to Fleet Performance)
    if (action === "ASSIGN") {
      const assignedToName = body.assigned_to_name || "Agent Fleet Performance";
      const assignedToId = body.assigned_to_id || null;

      const updated = await prisma.vehicleIssue.update({
        where: { id },
        data: {
          assigned_to_name: assignedToName,
          assigned_to_id: assignedToId,
          assigned_at: new Date(),
          status: existingIssue.status === "SOLVED" ? "SOLVED" : "IN_PROGRESS",
        },
      });

      touchSyncState("tickets");
      return NextResponse.json({ success: true, issue: updated });
    }

    // 2. ACTION: SOLVE (Problem marked as solved)
    if (action === "SOLVE") {
      const resolvedByName = body.resolved_by_name || existingIssue.assigned_to_name || "Agent";
      const resolutionNotes = body.resolution_notes || null;

      const updated = await prisma.vehicleIssue.update({
        where: { id },
        data: {
          status: "SOLVED",
          resolved_by_name: resolvedByName,
          resolved_at: new Date(),
          resolution_notes: resolutionNotes,
        },
      });

      // If linked to a maintenance ticket, optionally resolve the maintenance ticket as well
      if (existingIssue.linked_ticket_id && body.sync_maintenance_ticket) {
        await prisma.maintenanceTicket.update({
          where: { id: existingIssue.linked_ticket_id },
          data: {
            status: "RESOLVED",
            resolved_at: new Date(),
            resolution_notes: resolutionNotes ? `[Résolu via Journal Flotte] ${resolutionNotes}` : "Résolu via Journal Flotte",
          },
        }).catch(() => {});
      }

      touchSyncState("tickets");
      return NextResponse.json({ success: true, issue: updated });
    }

    // 3. ACTION: TRANSFORM TO SUPPORT TICKET
    if (action === "TRANSFORM_SUPPORT_TICKET") {
      const ticketType = body.ticket_type || "Repair";
      const priority = body.priority || existingIssue.priority || "Normal";
      const garageName = body.garage_name || null;
      const transferFieldSupervisor = Boolean(body.transfer_field_supervisor);

      // Create formal MaintenanceTicket
      const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const isAlreadySolved = existingIssue.status === "SOLVED" || body.mark_solved;

      const createdTicket = await prisma.maintenanceTicket.create({
        data: {
          vehicle_id: existingIssue.vehicle_id || "UNASSIGNED",
          plate_number: existingIssue.plate_number,
          driver_name: existingIssue.driver_name,
          driver_phone: existingIssue.driver_phone,
          ticket_type: ticketType,
          description: `[Transféré du Journal Flotte] ${existingIssue.title}\n\n${existingIssue.description}`,
          priority: priority,
          status: isAlreadySolved ? "RESOLVED" : "IN_PROGRESS",
          started_at: new Date(),
          resolved_at: isAlreadySolved ? new Date() : null,
          garage_name: garageName,
          sla_deadline: slaDeadline,
          resolution_notes: existingIssue.resolution_notes || null,
        },
      });

      let fieldTaskId = existingIssue.field_task_id;
      let telegramSent = existingIssue.telegram_alert_sent;

      // If checkbox to transfer to Field Supervisor & alert Telegram is checked
      if (transferFieldSupervisor && !fieldTaskId) {
        const fieldTask = await prisma.fieldTask.create({
          data: {
            task_type: ticketType === "Accident" ? "GARAGE_PICKUP" : "FIELD_VISIT",
            vehicle_id: existingIssue.vehicle_id,
            plate_number: existingIssue.plate_number,
            driver_name: existingIssue.driver_name,
            driver_phone: existingIssue.driver_phone,
            description: `[Mission Déclenchée] ${existingIssue.title} — ${existingIssue.description}`,
            priority: priority === "Critical" ? "Critical" : priority === "Urgent" ? "Urgent" : "Normal",
            status: "PENDING",
            linked_ticket_id: createdTicket.id,
          },
        }).catch((err) => {
          console.error("Failed to create field task from transformed ticket:", err);
          return null;
        });

        if (fieldTask) {
          fieldTaskId = fieldTask.id;
        }

        // Send Telegram alert
        await sendVehicleIssueTelegramAlert({
          plate_number: existingIssue.plate_number,
          driver_name: existingIssue.driver_name,
          driver_phone: existingIssue.driver_phone,
          category: existingIssue.category,
          title: `[Ticket #${createdTicket.id.slice(0, 8)}] ${existingIssue.title}`,
          description: existingIssue.description,
          priority: priority,
          reported_by: existingIssue.reported_by_name,
          assigned_to: existingIssue.assigned_to_name,
        }).catch((err) => {
          console.error("Failed to send Telegram alert for transformed ticket:", err);
        });

        telegramSent = true;
      }

      const updated = await prisma.vehicleIssue.update({
        where: { id },
        data: {
          linked_ticket_id: createdTicket.id,
          linked_ticket_type: ticketType,
          field_task_id: fieldTaskId,
          telegram_alert_sent: telegramSent,
          status: isAlreadySolved ? "SOLVED" : "IN_PROGRESS",
        },
      });

      touchSyncState("tickets");
      return NextResponse.json({ success: true, issue: updated, ticket: createdTicket });
    }

    // 4. ACTION: TRANSFER FIELD SUPERVISOR & SEND TELEGRAM ALERT
    if (action === "TRANSFER_FIELD_SUPERVISOR") {
      const taskType = body.task_type || "FIELD_VISIT";
      const priority = body.priority || existingIssue.priority || "Normal";

      const fieldTask = await prisma.fieldTask.create({
        data: {
          task_type: taskType,
          vehicle_id: existingIssue.vehicle_id,
          plate_number: existingIssue.plate_number,
          driver_name: existingIssue.driver_name,
          driver_phone: existingIssue.driver_phone,
          description: `[Journal Véhicule] ${existingIssue.title} — ${existingIssue.description}`,
          priority: priority === "Critical" ? "Critical" : priority === "Urgent" ? "Urgent" : "Normal",
          status: "PENDING",
          linked_ticket_id: existingIssue.linked_ticket_id || null,
        },
      });

      // Send Telegram alert to Field Supervisor group
      await sendVehicleIssueTelegramAlert({
        plate_number: existingIssue.plate_number,
        driver_name: existingIssue.driver_name,
        driver_phone: existingIssue.driver_phone,
        category: existingIssue.category,
        title: existingIssue.title,
        description: existingIssue.description,
        priority: priority,
        reported_by: existingIssue.reported_by_name,
        assigned_to: existingIssue.assigned_to_name,
      });

      const updated = await prisma.vehicleIssue.update({
        where: { id },
        data: {
          field_task_id: fieldTask.id,
          telegram_alert_sent: true,
          status: existingIssue.status === "SOLVED" ? "SOLVED" : "IN_PROGRESS",
        },
      });

      touchSyncState("tickets");
      return NextResponse.json({ success: true, issue: updated, fieldTask });
    }

    // Generic updates (title, description, priority, category, resolution_notes)
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.resolution_notes !== undefined) updateData.resolution_notes = body.resolution_notes;

    const updated = await prisma.vehicleIssue.update({
      where: { id },
      data: updateData,
    });

    touchSyncState("tickets");
    return NextResponse.json({ success: true, issue: updated });
  } catch (error: any) {
    console.error("PATCH /api/vehicle-issues/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update vehicle issue" }, { status: 500 });
  }
}

/**
 * DELETE /api/vehicle-issues/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.vehicleIssue.delete({
      where: { id },
    });

    touchSyncState("tickets");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
