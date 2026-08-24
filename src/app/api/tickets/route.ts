import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tickets
 * Fetches all maintenance and support tickets with optional filtering.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";

    const where: any = {};

    if (search) {
      where.OR = [
        { plate_number: { contains: search } },
        { driver_name: { contains: search } },
        { driver_phone: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.ticket_type = type;
    }

    const tickets = await prisma.maintenanceTicket.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets
 * Creates a new maintenance/support ticket and optionally updates vehicle status to "In garage" or "Accident".
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      vehicle_id,
      plate_number,
      driver_name,
      driver_phone,
      ticket_type,
      description,
      priority,
      update_vehicle_status,
    } = body;

    if (!vehicle_id || !plate_number || !ticket_type || !description) {
      return NextResponse.json(
        { error: "Vehicle, Plate Number, Ticket Type, and Description are required." },
        { status: 400 }
      );
    }

    const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        vehicle_id,
        plate_number: plate_number.trim(),
        driver_name: driver_name ? driver_name.trim() : null,
        driver_phone: driver_phone ? driver_phone.trim() : null,
        ticket_type: ticket_type.trim(),
        description: description.trim(),
        priority: priority || "Normal",
        status: "OPEN",
        sla_deadline: slaDeadline,
      },
    });

    // Optionally auto-update vehicle status based on ticket request
    if (update_vehicle_status) {
      let targetStatus = "Actif";
      if (ticket_type === "Accident") {
        targetStatus = "Accident";
      } else {
        targetStatus = "Actif";
      }
      
      await prisma.vehicle.update({
        where: { id: vehicle_id },
        data: { status: targetStatus },
      }).catch((e) => console.warn("Failed to update vehicle status on ticket creation:", e));
    }

    if (ticket_type === "Accident") {
      const activeClaim = await prisma.accidentClaim.findFirst({
        where: { 
          vehicle_id,
          timeline_step: { not: "VEHICLE_BACK" }
        }
      });
      if (!activeClaim) {
        await prisma.accidentClaim.create({
          data: {
            vehicle_id,
            driver_name: driver_name ? driver_name.trim() : null,
            driver_phone: driver_phone ? driver_phone.trim() : null,
          }
        });
      }
    }

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets error:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}
