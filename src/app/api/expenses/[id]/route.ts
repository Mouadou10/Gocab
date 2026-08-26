/**
 * Single Vehicle Expense API — /api/expenses/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expense = await prisma.vehicleExpense.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!expense) {
      return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
    }

    return NextResponse.json({ expense });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch expense" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.vehicleExpense.update({
      where: { id },
      data: {
        category: body.category,
        amount_mad: body.amount_mad !== undefined ? Number(body.amount_mad) : undefined,
        description: body.description,
        invoice_number: body.invoice_number,
        paid_by: body.paid_by,
        is_rechargeable: body.is_rechargeable,
        status: body.status,
        paid_at: body.paid_at ? new Date(body.paid_at) : undefined,
      },
    });

    return NextResponse.json({ success: true, expense: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.vehicleExpense.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Frais supprimé" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete expense" }, { status: 500 });
  }
}
