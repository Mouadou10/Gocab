import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/collections
 * Fetches daily collection summaries, filterable by date or collector.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || "";
    const collector = searchParams.get("collector") || "";

    const where: any = {};

    if (dateStr) {
      const dayStart = new Date(dateStr);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dateStr);
      dayEnd.setHours(23, 59, 59, 999);
      where.date = { gte: dayStart, lte: dayEnd };
    }

    if (collector) {
      where.collector_name = { contains: collector };
    }

    const collections = await prisma.dailyCollection.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    // Also fetch cancellations for today if date filter is set
    let cancellations: any[] = [];
    if (dateStr) {
      const dayStart = new Date(dateStr);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dateStr);
      dayEnd.setHours(23, 59, 59, 999);
      cancellations = await prisma.paymentCancellation.findMany({
        where: { date: { gte: dayStart, lte: dayEnd } },
        orderBy: { created_at: "desc" },
      });
    }

    return NextResponse.json({ collections, cancellations });
  } catch (error) {
    console.error("GET /api/collections error:", error);
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}

/**
 * POST /api/collections
 * Creates a daily collection entry (morning total target).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, collector_name, expected_total, notes } = body;

    if (!collector_name || expected_total === undefined || !date) {
      return NextResponse.json(
        { error: "Collector name, expected total, and date are required." },
        { status: 400 }
      );
    }

    const collection = await prisma.dailyCollection.create({
      data: {
        date: new Date(date),
        collector_name: collector_name.trim(),
        expected_total: Number(expected_total),
        notes: notes ? notes.trim() : null,
      },
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    console.error("POST /api/collections error:", error);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
