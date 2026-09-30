import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractVidangeStatsFromTickets } from "@/lib/vidangeStats";

export const dynamic = "force-dynamic";

/**
 * GET /api/vidanges/stats
 * Retrieves vidange counts by category (Simple vs Complète) calculated strictly from solved tickets.
 * Query params:
 * - vehicleId or vehicle_id: string
 * - plate or plate_number: string
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicleId") || searchParams.get("vehicle_id") || "";
    const plate = searchParams.get("plate") || searchParams.get("plate_number") || "";

    if (!vehicleId && !plate) {
      // Return stats map for all vehicles that have tickets
      const allTickets = await prisma.maintenanceTicket.findMany({
        where: {
          OR: [
            { ticket_type: "Vidange" },
            { description: { contains: "vidange" } },
            { resolution_notes: { contains: "vidange" } },
          ],
        },
        orderBy: { created_at: "desc" },
      });

      const ticketsByPlate: Record<string, any[]> = {};
      for (const t of allTickets) {
        const key = (t.plate_number || t.vehicle_id).trim();
        if (!ticketsByPlate[key]) ticketsByPlate[key] = [];
        ticketsByPlate[key].push(t);
      }

      const summaryMap: Record<string, any> = {};
      for (const [key, tList] of Object.entries(ticketsByPlate)) {
        summaryMap[key] = extractVidangeStatsFromTickets(tList);
      }

      return NextResponse.json({ statsMap: summaryMap });
    }

    // Find vehicle to resolve both ID and plate
    let vehicle = null;
    if (vehicleId) {
      vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true, plate_number: true, make_model: true, current_mileage: true },
      });
    }

    if (!vehicle && plate) {
      const cleanPlate = plate.trim();
      vehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { plate_number: cleanPlate },
            { plate_number: cleanPlate.replace(/[\s\-_|]/g, "") },
            { plate_number: { contains: cleanPlate } },
          ],
        },
        select: { id: true, plate_number: true, make_model: true, current_mileage: true },
      });
    }

    const whereConditions: any[] = [];
    if (vehicle) {
      whereConditions.push({ vehicle_id: vehicle.id });
      whereConditions.push({ plate_number: vehicle.plate_number });
    } else {
      if (vehicleId) whereConditions.push({ vehicle_id: vehicleId });
      if (plate) whereConditions.push({ plate_number: plate.trim() });
    }

    const tickets = await prisma.maintenanceTicket.findMany({
      where: {
        OR: whereConditions,
      },
      orderBy: { created_at: "desc" },
    });

    const stats = extractVidangeStatsFromTickets(tickets);

    return NextResponse.json({
      vehicle_id: vehicle?.id || vehicleId,
      plate_number: vehicle?.plate_number || plate,
      make_model: vehicle?.make_model || "",
      current_mileage: vehicle?.current_mileage || null,
      ...stats,
    });
  } catch (error: any) {
    console.error("GET /api/vidanges/stats error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch vidange stats" },
      { status: 500 }
    );
  }
}
