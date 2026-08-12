import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/vehicles
 * Fetches all vehicles from the database sorted by creation date or compliance status.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const hub = searchParams.get("hub") || "";
    const status = searchParams.get("status") || "";

    const where: any = {};

    if (search) {
      where.OR = [
        { plate_number: { contains: search } },
        { make_model: { contains: search } },
        { vin: { contains: search } },
      ];
    }

    if (hub) {
      where.hub_city = hub;
    }

    if (status) {
      where.status = status;
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        driverProfile: {
          select: { id: true, fullName: true, phoneSanitized: true }
        }
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("GET /api/vehicles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vehicles
 * Registers a new vehicle record in the fleet.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      plate_number,
      make_model,
      year,
      vin,
      current_mileage,
      hub_city,
      status,
      insurance_expiry_date,
      insurance_policy_number,
      vignette_expiry_date,
      autorisation_expiry_date,
      technical_inspection_expiry,
      assigned_driver_name,
      assigned_driver_phone,
      notes,
    } = body;

    if (!plate_number || !make_model || !hub_city) {
      return NextResponse.json(
        { error: "Plate number, Make/Model, and Hub City are required." },
        { status: 400 }
      );
    }

    // Check if plate number already exists
    const existing = await prisma.vehicle.findUnique({
      where: { plate_number: plate_number.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Vehicle with plate number ${plate_number} already exists.` },
        { status: 409 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plate_number: plate_number.trim(),
        make_model: make_model.trim(),
        year: year ? Number(year) : new Date().getFullYear(),
        vin: vin ? vin.trim() : null,
        current_mileage: current_mileage ? Number(current_mileage) : 0,
        hub_city: hub_city.trim(),
        status: status || "Available",
        insurance_expiry_date: insurance_expiry_date ? new Date(insurance_expiry_date) : null,
        insurance_policy_number: insurance_policy_number ? insurance_policy_number.trim() : null,
        vignette_expiry_date: vignette_expiry_date ? new Date(vignette_expiry_date) : null,
        autorisation_expiry_date: autorisation_expiry_date ? new Date(autorisation_expiry_date) : null,
        technical_inspection_expiry: technical_inspection_expiry ? new Date(technical_inspection_expiry) : null,
        assigned_driver_name: assigned_driver_name ? assigned_driver_name.trim() : null,
        assigned_driver_phone: assigned_driver_phone ? assigned_driver_phone.trim() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error("POST /api/vehicles error:", error);
    return NextResponse.json(
      { error: "Failed to create vehicle record" },
      { status: 500 }
    );
  }
}
