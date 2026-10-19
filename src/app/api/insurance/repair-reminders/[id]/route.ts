/**
 * Single Insurance Repair Reminder API — /api/insurance/repair-reminders/[id]
 * 
 * Supports updating status (PENDING, IN_REPAIR, COMPLETED, CANCELLED),
 * rescheduling reminder date, adding notes, uploading additional photos,
 * or deleting a reminder.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await context.params;
    const body = await request.json();

    const existing = await (prisma as any).repairReminder.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Rappel de réparation introuvable" },
        { status: 404 }
      );
    }

    const {
      status,
      reminder_date,
      reminder_time,
      garage_name,
      repair_type,
      title,
      description,
      photos,
      estimated_cost_mad,
      priority,
      agent_notes,
    } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (reminder_date !== undefined) updateData.reminder_date = reminder_date;
    if (reminder_time !== undefined) updateData.reminder_time = reminder_time;
    if (garage_name !== undefined) updateData.garage_name = garage_name;
    if (repair_type !== undefined) updateData.repair_type = repair_type;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (photos !== undefined) {
      updateData.photos = JSON.stringify(Array.isArray(photos) ? photos : []);
    }
    if (estimated_cost_mad !== undefined) {
      updateData.estimated_cost_mad = Number(estimated_cost_mad) || 0;
    }
    if (priority !== undefined) updateData.priority = priority;
    if (agent_notes !== undefined) updateData.agent_notes = agent_notes;

    const updated = await (prisma as any).repairReminder.update({
      where: { id },
      data: updateData,
    });

    // If marked as IN_REPAIR and vehicle exists, optionally update vehicle status to "In garage"
    if (status === "IN_REPAIR" && existing.vehicle_id) {
      try {
        await prisma.vehicle.update({
          where: { id: existing.vehicle_id },
          data: { status: "In garage" },
        });
      } catch (vehErr) {
        console.warn("Could not auto-update vehicle status:", vehErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Rappel de réparation mis à jour avec succès",
      reminder: updated,
    });
  } catch (error: any) {
    console.error("PATCH /api/insurance/repair-reminders/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update repair reminder" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const existing = await (prisma as any).repairReminder.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Rappel de réparation introuvable" },
        { status: 404 }
      );
    }

    await (prisma as any).repairReminder.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Rappel de réparation supprimé",
    });
  } catch (error: any) {
    console.error("DELETE /api/insurance/repair-reminders/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to delete repair reminder" },
      { status: 500 }
    );
  }
}
