import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/collections/[id]
 * Updates collected total at end of day or notes.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = {};

    if (body.collected_total !== undefined) updateData.collected_total = Number(body.collected_total);
    if (body.expected_total !== undefined) updateData.expected_total = Number(body.expected_total);
    if (body.notes !== undefined) updateData.notes = body.notes ? body.notes.trim() : null;

    const collection = await prisma.dailyCollection.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ collection });
  } catch (error) {
    console.error("PATCH /api/collections/[id] error:", error);
    return NextResponse.json({ error: "Failed to update collection" }, { status: 500 });
  }
}

/**
 * DELETE /api/collections/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.dailyCollection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/collections/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
  }
}
