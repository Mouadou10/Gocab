/**
 * Lead Update API Route — PATCH /api/leads/[id]
 *
 * Updates a single lead's board_column, brand_status,
 * training_status, and/or reminder_date.
 * Called by the Brand Filter and Training Update modals.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BoardColumn } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build the update payload from provided fields
    const updateData: {
      board_column?: BoardColumn;
      brand_status?: string;
      training_status?: string;
      reminder_date?: Date | null;
    } = {};

    if (body.board_column !== undefined) {
      updateData.board_column = body.board_column as BoardColumn;
    }
    if (body.brand_status !== undefined) {
      updateData.brand_status = body.brand_status;
    }
    if (body.training_status !== undefined) {
      updateData.training_status = body.training_status;
    }
    if (body.reminder_date !== undefined) {
      updateData.reminder_date = body.reminder_date
        ? new Date(body.reminder_date)
        : null;
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ lead: updatedLead });
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}
