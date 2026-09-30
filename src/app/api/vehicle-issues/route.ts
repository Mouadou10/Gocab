import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { sendVehicleIssueTelegramAlert } from "@/lib/services/telegramService";

export const dynamic = "force-dynamic";

/**
 * GET /api/vehicle-issues
 * Fetches all vehicle operational issues & remarks.
 * Everyone can view this feed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const plate = (searchParams.get("plate") || "").trim();

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (category && category !== "ALL") {
      where.category = category;
    }

    if (plate) {
      where.plate_number = { contains: plate };
    }

    if (search) {
      where.OR = [
        { plate_number: { contains: search } },
        { driver_name: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
        { reported_by_name: { contains: search } },
        { assigned_to_name: { contains: search } },
      ];
    }

    const issues = await prisma.vehicleIssue.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ issues });
  } catch (error: any) {
    console.error("GET /api/vehicle-issues error:", error);
    return NextResponse.json({ error: "Failed to fetch vehicle issues" }, { status: 500 });
  }
}

/**
 * POST /api/vehicle-issues
 * Creates a new vehicle issue/remark.
 * Any role can report an issue regarding a vehicle.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      plate_number,
      vehicle_id,
      driver_name,
      driver_phone,
      category,
      title,
      description,
      priority,
      reported_by_name,
      reported_by_role,
      reported_by_email,
      notify_telegram,
      transfer_field_supervisor,
    } = body;

    if (!plate_number || !title || !description) {
      return NextResponse.json(
        { error: "Le matricule du véhicule, le titre et la description sont requis." },
        { status: 400 }
      );
    }

    // Try finding the vehicle and active driver if not provided
    let resolvedVehicleId = vehicle_id || null;
    let resolvedDriverName = driver_name || null;
    let resolvedDriverPhone = driver_phone || null;

    if (!resolvedVehicleId || !resolvedDriverName) {
      const v = await prisma.vehicle.findFirst({
        where: { plate_number: plate_number.trim() },
        include: { driverProfile: true },
      });
      if (v) {
        resolvedVehicleId = v.id;
        if (!resolvedDriverName) {
          resolvedDriverName = v.assigned_driver_name || v.driverProfile?.fullName || null;
        }
        if (!resolvedDriverPhone) {
          resolvedDriverPhone = v.assigned_driver_phone || v.driverProfile?.phoneSanitized || null;
        }
      }
    }

    // Create the issue in database
    const issue = await prisma.vehicleIssue.create({
      data: {
        plate_number: plate_number.trim(),
        vehicle_id: resolvedVehicleId,
        driver_name: resolvedDriverName,
        driver_phone: resolvedDriverPhone,
        category: category || "MECANIQUE",
        title: title.trim(),
        description: description.trim(),
        priority: priority || "Normal",
        status: "PENDING",
        reported_by_name: reported_by_name || "Agent",
        reported_by_role: reported_by_role || null,
        reported_by_email: reported_by_email || null,
        telegram_alert_sent: false,
      },
    });

    // If checkbox to transfer to Field Supervisor or notify Telegram was checked:
    if (transfer_field_supervisor || notify_telegram) {
      // 1. Create a FieldTask for the field supervisor
      let createdFieldTaskId: string | null = null;
      if (transfer_field_supervisor) {
        const fieldTask = await prisma.fieldTask.create({
          data: {
            task_type: category === "ACCIDENT" ? "GARAGE_PICKUP" : "FIELD_VISIT",
            vehicle_id: resolvedVehicleId,
            plate_number: plate_number.trim(),
            driver_name: resolvedDriverName,
            driver_phone: resolvedDriverPhone,
            description: `[Journal Véhicule] ${title.trim()} — ${description.trim()}`,
            priority: priority === "Critical" ? "Critical" : priority === "Urgent" ? "Urgent" : "Normal",
            status: "PENDING",
          },
        }).catch((err) => {
          console.error("Failed to auto-create field task:", err);
          return null;
        });

        if (fieldTask) {
          createdFieldTaskId = fieldTask.id;
        }
      }

      // 2. Send Telegram Alert
      await sendVehicleIssueTelegramAlert({
        plate_number: plate_number.trim(),
        driver_name: resolvedDriverName,
        driver_phone: resolvedDriverPhone,
        category: category || "MECANIQUE",
        title: title.trim(),
        description: description.trim(),
        priority: priority || "Normal",
        reported_by: reported_by_name || "Agent",
      }).catch((err) => {
        console.error("Failed to send Telegram alert on create:", err);
      });

      // Update issue with field_task_id and telegram_alert_sent
      await prisma.vehicleIssue.update({
        where: { id: issue.id },
        data: {
          field_task_id: createdFieldTaskId,
          telegram_alert_sent: true,
          status: createdFieldTaskId ? "IN_PROGRESS" : "PENDING",
        },
      });
    }

    touchSyncState("tickets");

    return NextResponse.json({ success: true, issue });
  } catch (error: any) {
    console.error("POST /api/vehicle-issues error:", error);
    return NextResponse.json({ error: error.message || "Failed to create vehicle issue" }, { status: 500 });
  }
}
