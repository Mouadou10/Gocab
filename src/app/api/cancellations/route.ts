import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cancellations
 * Fetches payment cancellations, optionally filtered by date or pending approval.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || "";
    const pending = searchParams.get("pending"); // "true" = only auto-waiver pending approval
    const search = searchParams.get("search") || "";

    const where: any = {};

    if (dateStr) {
      const dayStart = new Date(dateStr);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dateStr);
      dayEnd.setHours(23, 59, 59, 999);
      where.date = { gte: dayStart, lte: dayEnd };
    }

    if (pending === "true") {
      where.auto_waiver = true;
      where.approved = false;
    }

    if (search) {
      where.OR = [
        { driver_name: { contains: search } },
        { plate_number: { contains: search } },
      ];
    }

    const cancellations = await prisma.paymentCancellation.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ cancellations });
  } catch (error) {
    console.error("GET /api/cancellations error:", error);
    return NextResponse.json({ error: "Failed to fetch cancellations" }, { status: 500 });
  }
}

/**
 * POST /api/cancellations
 * Creates a payment cancellation for a driver (manual or auto-waiver).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      date,
      driver_name,
      driver_phone,
      plate_number,
      vehicle_id,
      reason,
      linked_ticket_id,
      auto_waiver,
      collection_id,
    } = body;

    if (!driver_name || !reason || !date) {
      return NextResponse.json(
        { error: "Driver name, reason, and date are required." },
        { status: 400 }
      );
    }

    const cancellation = await prisma.paymentCancellation.create({
      data: {
        date: new Date(date),
        driver_name: driver_name.trim(),
        driver_phone: driver_phone ? driver_phone.trim() : null,
        plate_number: plate_number ? plate_number.trim() : null,
        vehicle_id: vehicle_id || null,
        reason: reason.trim(),
        linked_ticket_id: linked_ticket_id || null,
        auto_waiver: auto_waiver || false,
        approved: auto_waiver ? false : true, // Manual cancellations are auto-approved
        collection_id: collection_id || null,
      },
    });

    return NextResponse.json({ cancellation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/cancellations error:", error);
    return NextResponse.json({ error: "Failed to create cancellation" }, { status: 500 });
  }
}
