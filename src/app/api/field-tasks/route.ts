import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/field-tasks
 * Fetches all field supervisor tasks, filterable by status, type, or vehicle.
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
        { description: { contains: search } },
      ];
    }

    if (status) where.status = status;
    if (type) where.task_type = type;

    const tasks = await prisma.fieldTask.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("GET /api/field-tasks error:", error);
    return NextResponse.json({ error: "Failed to fetch field tasks" }, { status: 500 });
  }
}

/**
 * POST /api/field-tasks
 * Creates a new field task (vehicle recovery, monthly checkup, garage pickup).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      task_type,
      vehicle_id,
      plate_number,
      driver_name,
      driver_phone,
      description,
      priority,
      linked_ticket_id,
      due_date,
    } = body;

    if (!task_type || !description) {
      return NextResponse.json(
        { error: "Task type and description are required." },
        { status: 400 }
      );
    }

    const task = await prisma.fieldTask.create({
      data: {
        task_type: task_type.trim(),
        vehicle_id: vehicle_id || null,
        plate_number: plate_number ? plate_number.trim() : null,
        driver_name: driver_name ? driver_name.trim() : null,
        driver_phone: driver_phone ? driver_phone.trim() : null,
        description: description.trim(),
        priority: priority || "Normal",
        linked_ticket_id: linked_ticket_id || null,
        due_date: due_date ? new Date(due_date) : null,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("POST /api/field-tasks error:", error);
    return NextResponse.json({ error: "Failed to create field task" }, { status: 500 });
  }
}
