import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/cancellations/[id]
 * Approves auto-waiver or updates cancellation.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = {};

    if (body.approved !== undefined) updateData.approved = Boolean(body.approved);
    if (body.reason !== undefined) updateData.reason = body.reason.trim();

    const cancellation = await prisma.paymentCancellation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ cancellation });
  } catch (error) {
    console.error("PATCH /api/cancellations/[id] error:", error);
    return NextResponse.json({ error: "Failed to update cancellation" }, { status: 500 });
  }
}

/**
 * DELETE /api/cancellations/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.paymentCancellation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/cancellations/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete cancellation" }, { status: 500 });
  }
}
