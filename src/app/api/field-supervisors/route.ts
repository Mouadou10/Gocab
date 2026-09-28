import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Standard working hours slots (08:00 - 18:00)
const WORKING_HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const todayStr = new Date().toISOString().split("T")[0];
    const date = searchParams.get("date") || todayStr;

    // 1. Fetch only Field Supervisors (exclude Ops Managers, Admins, etc.)
    let supervisors = await prisma.user.findMany({
      where: {
        role: { in: ["FIELD_SUPERVISOR", "SENIOR_FIELD_SUPERVISOR"] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        fullName: true,
        email: true,
        role: true,
        region: true,
      },
      orderBy: { name: "asc" },
    });

    // Fallback: If no field supervisors found in DB, seed Hamza, Ayoub, Mohamed Abed
    if (supervisors.length === 0) {
      supervisors = [
        {
          id: "hamza-rassid",
          name: "HAMZA RASSID",
          fullName: "HAMZA RASSID",
          email: "hamza.rassid@gocab.io",
          role: "FIELD_SUPERVISOR",
          region: "CASABLANCA",
        },
        {
          id: "ayoub-rassid",
          name: "Ayoub Rassid",
          fullName: "Ayoub Rassid",
          email: "ayoub.rassid@gocab.io",
          role: "FIELD_SUPERVISOR",
          region: "CASABLANCA",
        },
      ];
    }

    // 2. Fetch all scheduled tasks for this date
    const scheduledTasks = await prisma.fieldTask.findMany({
      where: {
        scheduled_date: date,
        status: { not: "FAILED" },
      },
      select: {
        id: true,
        task_type: true,
        plate_number: true,
        driver_name: true,
        description: true,
        priority: true,
        status: true,
        assigned_to: true,
        scheduled_date: true,
        scheduled_time: true,
        duration_hours: true,
      },
    });

    // 3. Compute workload, occupied slots, capacity, and smart suggestions for each supervisor
    const enrichedSupervisors = supervisors.map((sup) => {
      // Match by assigned_to (either ID or name or email)
      const supTasks = scheduledTasks.filter(
        (t) =>
          t.assigned_to === sup.id ||
          t.assigned_to === sup.name ||
          t.assigned_to === sup.fullName ||
          t.assigned_to === sup.email
      );

      const totalHours = supTasks.reduce(
        (sum, t) => sum + (t.duration_hours && t.duration_hours > 0 ? t.duration_hours : 1.0),
        0
      );

      const isFull = totalHours >= 8.0;
      const availableHours = Math.max(0, 8.0 - totalHours);

      // Track occupied hours
      const occupiedTimeSet = new Set<string>();
      supTasks.forEach((t) => {
        if (t.scheduled_time) {
          occupiedTimeSet.add(t.scheduled_time);
          // If duration > 1, block subsequent slots
          const dur = t.duration_hours || 1.0;
          if (dur > 1) {
            const startHour = parseInt(t.scheduled_time.split(":")[0], 10);
            for (let i = 1; i < Math.ceil(dur); i++) {
              const nextH = (startHour + i).toString().padStart(2, "0") + ":00";
              occupiedTimeSet.add(nextH);
            }
          }
        }
      });

      // Find first empty slot today
      const firstFreeToday = WORKING_HOURS.find((h) => !occupiedTimeSet.has(h)) || null;

      // Calculate next suggested date if today is full
      let suggestedDate = date;
      let suggestedTime = firstFreeToday;

      if (isFull || !firstFreeToday) {
        const d = new Date(date);
        d.setDate(d.getDate() + 1);
        suggestedDate = d.toISOString().split("T")[0];
        suggestedTime = "09:00"; // default morning slot on next day
      }

      return {
        ...sup,
        scheduled_tasks_count: supTasks.length,
        total_scheduled_hours: Number(totalHours.toFixed(1)),
        is_full: isFull,
        available_hours: Number(availableHours.toFixed(1)),
        occupied_slots: Array.from(occupiedTimeSet),
        suggested_date: suggestedDate,
        suggested_time: suggestedTime,
      };
    });

    return NextResponse.json({
      supervisors: enrichedSupervisors,
      selected_date: date,
      working_hours: WORKING_HOURS,
    });
  } catch (error) {
    console.error("GET /api/field-supervisors error:", error);
    return NextResponse.json(
      { error: "Failed to fetch field supervisors" },
      { status: 500 }
    );
  }
}
