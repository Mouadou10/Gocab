/**
 * Insurance Repair Reminders API — /api/insurance/repair-reminders
 * 
 * Allows agents to schedule repair reminders for vehicles with photos,
 * estimated costs, target garage, reminder dates and overdue alerts.
 * Enriched with Red Flag driver status.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getActiveRedFlagsLookup } from "@/lib/services/redFlagService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status"); // ALL, PENDING, DUE, IN_REPAIR, COMPLETED
    const vehicleIdParam = searchParams.get("vehicle_id");
    const searchParam = searchParams.get("search")?.trim().toLowerCase();

    const todayStr = new Date().toISOString().split("T")[0];

    // Build filter
    const where: any = {};
    if (vehicleIdParam) {
      where.vehicle_id = vehicleIdParam;
    }
    if (statusParam && statusParam !== "ALL") {
      if (statusParam === "DUE") {
        where.status = "PENDING";
        where.reminder_date = { lte: todayStr };
      } else {
        where.status = statusParam;
      }
    }

    const [remindersRaw, allVehicles, redFlagsLookup] = await Promise.all([
      (prisma as any).repairReminder.findMany({
        where,
        orderBy: [
          { reminder_date: "asc" },
          { created_at: "desc" },
        ],
      }),
      prisma.vehicle.findMany({
        where: { is_archived: false },
        select: {
          id: true,
          plate_number: true,
          make_model: true,
          hub_city: true,
          status: true,
          assigned_driver_name: true,
          assigned_driver_phone: true,
          driverProfile: {
            select: {
              id: true,
              fullName: true,
              phoneSanitized: true,
              cinNumber: true,
              isRedFlagged: true,
              redFlagReason: true,
            },
          },
        },
      }),
      getActiveRedFlagsLookup(),
    ]);

    // Map vehicles by ID and plate
    const vehicleById = new Map<string, typeof allVehicles[0]>();
    const vehicleByPlate = new Map<string, typeof allVehicles[0]>();
    for (const v of allVehicles) {
      vehicleById.set(v.id, v);
      vehicleByPlate.set(v.plate_number.replace(/\s+/g, "").toUpperCase(), v);
    }

    let pendingCount = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let inRepairCount = 0;
    let completedCount = 0;

    const enrichedReminders = remindersRaw.map((item: any) => {
      const cleanPlate = (item.plate_number || "").replace(/\s+/g, "").toUpperCase();
      const matchedVeh = (item.vehicle_id && vehicleById.get(item.vehicle_id)) || vehicleByPlate.get(cleanPlate);

      const driverName = item.driver_name || matchedVeh?.driverProfile?.fullName || matchedVeh?.assigned_driver_name || null;
      const driverPhone = item.driver_phone || matchedVeh?.driverProfile?.phoneSanitized || matchedVeh?.assigned_driver_phone || null;
      const driverId = matchedVeh?.driverProfile?.id || null;

      const rfCheck = redFlagsLookup.checkDriver({
        id: driverId,
        name: driverName,
        phone: driverPhone,
        cin: matchedVeh?.driverProfile?.cinNumber,
      });

      const isDriverRedFlagged = Boolean(matchedVeh?.driverProfile?.isRedFlagged || rfCheck.isRedFlagged);
      const driverRedFlagReason = matchedVeh?.driverProfile?.redFlagReason || rfCheck.reason || null;

      // Status & dates calculation
      const isDueToday = item.reminder_date === todayStr && item.status === "PENDING";
      const isOverdue = item.reminder_date < todayStr && item.status === "PENDING";
      const isDueOrOverdue = (item.reminder_date <= todayStr) && item.status === "PENDING";

      if (item.status === "PENDING") {
        pendingCount++;
        if (isDueToday) dueTodayCount++;
        if (isOverdue) overdueCount++;
      } else if (item.status === "IN_REPAIR") {
        inRepairCount++;
      } else if (item.status === "COMPLETED") {
        completedCount++;
      }

      // Parse photos safely
      let parsedPhotos: any[] = [];
      try {
        if (item.photos) {
          parsedPhotos = typeof item.photos === "string" ? JSON.parse(item.photos) : item.photos;
          if (!Array.isArray(parsedPhotos)) parsedPhotos = [];
        }
      } catch {
        parsedPhotos = [];
      }

      return {
        ...item,
        photos: parsedPhotos,
        vehicle_make_model: matchedVeh?.make_model || "Véhicule Flotte",
        vehicle_hub_city: matchedVeh?.hub_city || "Casablanca",
        vehicle_status: matchedVeh?.status || "Actif",
        driver_name: driverName,
        driver_phone: driverPhone,
        is_driver_red_flagged: isDriverRedFlagged,
        driver_red_flag_reason: driverRedFlagReason,
        is_due_today: isDueToday,
        is_overdue: isOverdue,
        is_due_or_overdue: isDueOrOverdue,
      };
    });

    // Apply search filter if requested
    const filteredReminders = searchParam
      ? enrichedReminders.filter((r: any) => {
          const plateMatch = (r.plate_number || "").toLowerCase().includes(searchParam);
          const titleMatch = (r.title || "").toLowerCase().includes(searchParam);
          const descMatch = (r.description || "").toLowerCase().includes(searchParam);
          const garageMatch = (r.garage_name || "").toLowerCase().includes(searchParam);
          const driverMatch = (r.driver_name || "").toLowerCase().includes(searchParam);
          const typeMatch = (r.repair_type || "").toLowerCase().includes(searchParam);
          return plateMatch || titleMatch || descMatch || garageMatch || driverMatch || typeMatch;
        })
      : enrichedReminders;

    return NextResponse.json({
      success: true,
      reminders: filteredReminders,
      summary: {
        total: remindersRaw.length,
        pending: pendingCount,
        due_today: dueTodayCount,
        overdue: overdueCount,
        due_or_overdue: dueTodayCount + overdueCount,
        in_repair: inRepairCount,
        completed: completedCount,
      },
    });
  } catch (error: any) {
    console.error("GET /api/insurance/repair-reminders error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch repair reminders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const {
      vehicle_id,
      plate_number,
      driver_name,
      driver_phone,
      reminder_date,
      reminder_time,
      garage_name,
      repair_type = "Carrosserie",
      title,
      description,
      photos = [],
      estimated_cost_mad = 0,
      priority = "Normal",
      agent_notes,
    } = body;

    if (!reminder_date) {
      return NextResponse.json(
        { success: false, error: "La date de rappel pour la réparation est obligatoire" },
        { status: 400 }
      );
    }

    if (!plate_number && !vehicle_id) {
      return NextResponse.json(
        { success: false, error: "Le véhicule ou l'immatriculation est requis" },
        { status: 400 }
      );
    }

    // Resolve vehicle details if vehicle_id is provided
    let resolvedPlate = plate_number ? plate_number.trim().toUpperCase() : "";
    let resolvedDriverName = driver_name ? driver_name.trim() : null;
    let resolvedDriverPhone = driver_phone ? driver_phone.trim() : null;

    if (vehicle_id) {
      const v = await prisma.vehicle.findUnique({
        where: { id: vehicle_id },
        include: { driverProfile: true },
      });
      if (v) {
        if (!resolvedPlate) resolvedPlate = v.plate_number;
        if (!resolvedDriverName) {
          resolvedDriverName = v.driverProfile?.fullName || v.assigned_driver_name || null;
        }
        if (!resolvedDriverPhone) {
          resolvedDriverPhone = v.driverProfile?.phoneSanitized || v.assigned_driver_phone || null;
        }
      }
    }

    const createdBy = session?.user?.name || session?.user?.email || "Agent Assurance";
    const resolvedTitle = title ? title.trim() : `Rappel Réparation ${repair_type} - ${resolvedPlate}`;
    const resolvedDesc = description ? description.trim() : `Véhicule prévu pour réparation / carrosserie chez ${garage_name || "garage partenaire"}`;

    const newReminder = await (prisma as any).repairReminder.create({
      data: {
        vehicle_id: vehicle_id || null,
        plate_number: resolvedPlate,
        driver_name: resolvedDriverName,
        driver_phone: resolvedDriverPhone,
        reminder_date: reminder_date.trim(),
        reminder_time: reminder_time ? reminder_time.trim() : null,
        garage_name: garage_name ? garage_name.trim() : null,
        repair_type: repair_type.trim(),
        title: resolvedTitle,
        description: resolvedDesc,
        photos: JSON.stringify(Array.isArray(photos) ? photos : []),
        estimated_cost_mad: Number(estimated_cost_mad) || 0,
        priority: priority || "Normal",
        status: "PENDING",
        agent_notes: agent_notes ? agent_notes.trim() : null,
        created_by: createdBy,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Rappel de réparation programmé avec succès pour le véhicule ${resolvedPlate}`,
      reminder: newReminder,
    });
  } catch (error: any) {
    console.error("POST /api/insurance/repair-reminders error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create repair reminder" },
      { status: 500 }
    );
  }
}
