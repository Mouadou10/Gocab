import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/inspections
 * Fetches vehicle inspections, filterable by vehicle or inspector.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicle_id") || "";
    const plateNumber = searchParams.get("plate_number") || "";
    const inspector = searchParams.get("inspector") || "";

    const where: any = {};

    if (vehicleId) where.vehicle_id = vehicleId;
    if (plateNumber) where.plate_number = { contains: plateNumber };
    if (inspector) where.inspector_name = { contains: inspector };

    const inspections = await prisma.vehicleInspection.findMany({
      where,
      orderBy: { inspection_date: "desc" },
    });

    return NextResponse.json({ inspections });
  } catch (error) {
    console.error("GET /api/inspections error:", error);
    return NextResponse.json({ error: "Failed to fetch inspections" }, { status: 500 });
  }
}

/**
 * POST /api/inspections
 * Creates a new vehicle mechanical inspection with scored checkpoints.
 * Auto-calculates health_score and fetches previous_health_score.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      vehicle_id,
      plate_number,
      inspector_name,
      current_mileage,
      brakes_score,
      tires_score,
      engine_score,
      oil_level_score,
      lights_score,
      suspension_score,
      body_condition_score,
      interior_score,
      battery_score,
      exhaust_score,
      notes,
      linked_task_id,
    } = body;

    if (!vehicle_id || !plate_number || !inspector_name) {
      return NextResponse.json(
        { error: "Vehicle ID, plate number, and inspector name are required." },
        { status: 400 }
      );
    }

    // Calculate overall health score (average of all non-zero checkpoints)
    const scores = [
      brakes_score, tires_score, engine_score, oil_level_score,
      lights_score, suspension_score, body_condition_score,
      interior_score, battery_score, exhaust_score,
    ].map(Number).filter((s) => s > 0);

    const health_score = scores.length > 0
      ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
      : 0;

    // Fetch previous inspection for comparison
    const previousInspection = await prisma.vehicleInspection.findFirst({
      where: { vehicle_id },
      orderBy: { inspection_date: "desc" },
    });

    const previous_health_score = previousInspection ? previousInspection.health_score : 0;

    const inspection = await prisma.vehicleInspection.create({
      data: {
        vehicle_id,
        plate_number: plate_number.trim(),
        inspector_name: inspector_name.trim(),
        current_mileage: Number(current_mileage) || 0,
        brakes_score: Number(brakes_score) || 0,
        tires_score: Number(tires_score) || 0,
        engine_score: Number(engine_score) || 0,
        oil_level_score: Number(oil_level_score) || 0,
        lights_score: Number(lights_score) || 0,
        suspension_score: Number(suspension_score) || 0,
        body_condition_score: Number(body_condition_score) || 0,
        interior_score: Number(interior_score) || 0,
        battery_score: Number(battery_score) || 0,
        exhaust_score: Number(exhaust_score) || 0,
        health_score,
        previous_health_score,
        notes: notes ? notes.trim() : null,
        linked_task_id: linked_task_id || null,
      },
    });

    // If linked to a MONTHLY_CHECKUP task, mark it as completed
    if (linked_task_id) {
      await prisma.fieldTask.update({
        where: { id: linked_task_id },
        data: { status: "COMPLETED", completed_at: new Date() },
      }).catch((e) => console.warn("Failed to auto-complete linked field task:", e));
    }

    return NextResponse.json({ inspection }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inspections error:", error);
    return NextResponse.json({ error: "Failed to create inspection" }, { status: 500 });
  }
}
