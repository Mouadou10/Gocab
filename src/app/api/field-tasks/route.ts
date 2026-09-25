import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendFieldTaskTelegramAlert } from "@/lib/services/telegramService";
import { touchSyncState } from "@/lib/sync";

export const dynamic = "force-dynamic";

let lastSyncTimestamp = 0;

async function syncRecoveryTasksAndOrphans() {
  const now = Date.now();
  // Throttle to avoid redundant sequential Turso roundtrips
  if (now - lastSyncTimestamp < 30_000) return;
  lastSyncTimestamp = now;

  try {
    // 1. Auto-clean orphaned tasks whose linked_ticket_id is no longer present in MaintenanceTicket
    const tasksWithLinkedTickets = await prisma.fieldTask.findMany({
      where: { linked_ticket_id: { not: null } },
      select: { id: true, linked_ticket_id: true, vehicle_id: true, plate_number: true, task_type: true },
    });

    if (tasksWithLinkedTickets.length > 0) {
      const allLinkedTicketIds = tasksWithLinkedTickets.map((t) => t.linked_ticket_id as string);
      const existingTickets = await prisma.maintenanceTicket.findMany({
        where: { id: { in: allLinkedTicketIds } },
        select: { id: true },
      });
      const validTicketIds = new Set(existingTickets.map((t) => t.id));
      const orphanedTasks = tasksWithLinkedTickets.filter((t) => !validTicketIds.has(t.linked_ticket_id!));

      if (orphanedTasks.length > 0) {
        const orphanIds = orphanedTasks.map((t) => t.id);
        await prisma.fieldTask.deleteMany({
          where: { id: { in: orphanIds } },
        });

        // Unblock vehicles if they were blocked by orphaned recovery tasks
        for (const orphan of orphanedTasks) {
          if (orphan.task_type === "VEHICLE_RECOVERY" && (orphan.vehicle_id || orphan.plate_number)) {
            await prisma.vehicle.updateMany({
              where: {
                OR: [
                  ...(orphan.vehicle_id ? [{ id: orphan.vehicle_id }] : []),
                  ...(orphan.plate_number ? [{ plate_number: orphan.plate_number }] : []),
                ],
                status: "Blocked",
              },
              data: { status: "Actif" },
            }).catch(() => {});
          }
        }
      }
    }

    // 2. Auto-sync any open recovery tickets from Support Kanban into FieldTask
    const openRecoveryTickets = await prisma.maintenanceTicket.findMany({
      where: {
        ticket_type: { in: ["VEHICLE_RECOVERY", "Vehicle Recovery"] },
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    });

    if (openRecoveryTickets.length > 0) {
      const existingTasks = await prisma.fieldTask.findMany({
        where: {
          task_type: "VEHICLE_RECOVERY",
          linked_ticket_id: { in: openRecoveryTickets.map((t) => t.id) },
        },
        select: { linked_ticket_id: true },
      });
      const existingIds = new Set(existingTasks.map((t) => t.linked_ticket_id));

      for (const t of openRecoveryTickets) {
        if (!existingIds.has(t.id)) {
          await prisma.fieldTask.create({
            data: {
              task_type: "VEHICLE_RECOVERY",
              vehicle_id: t.vehicle_id,
              plate_number: t.plate_number,
              driver_name: t.driver_name,
              driver_phone: t.driver_phone,
              description: t.description || "Véhicule bloqué / Récupération terrain",
              priority: t.priority || "Urgent",
              status: t.status === "IN_PROGRESS" ? "IN_PROGRESS" : "PENDING",
              linked_ticket_id: t.id,
              created_at: t.created_at,
            },
          }).catch(() => {});
        }
      }
    }

    // 3. Bi-directional sync: Auto-create MaintenanceTicket on the Ticket page for any active VEHICLE_RECOVERY FieldTask missing linked_ticket_id
    const unlinkedRecoveryTasks = await prisma.fieldTask.findMany({
      where: {
        task_type: "VEHICLE_RECOVERY",
        status: { in: ["PENDING", "IN_PROGRESS"] },
        linked_ticket_id: null,
      },
    });

    for (const ft of unlinkedRecoveryTasks) {
      const slaDeadline = new Date(new Date(ft.created_at).getTime() + 24 * 60 * 60 * 1000);
      const createdTicket = await prisma.maintenanceTicket.create({
        data: {
          vehicle_id: ft.vehicle_id || "UNASSIGNED",
          plate_number: ft.plate_number || "Véhicule non assigné",
          driver_name: ft.driver_name,
          driver_phone: ft.driver_phone,
          ticket_type: "VEHICLE_RECOVERY",
          description: ft.description || "Véhicule bloqué / Récupération terrain",
          priority: ft.priority || "Critical",
          status: ft.status === "IN_PROGRESS" ? "IN_PROGRESS" : "OPEN",
          sla_deadline: slaDeadline,
          is_archived: false,
          created_at: ft.created_at,
        },
      }).catch(() => null);

      if (createdTicket) {
        await prisma.fieldTask.update({
          where: { id: ft.id },
          data: { linked_ticket_id: createdTicket.id },
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.warn("FieldTask background sync error:", err?.message || err);
  }
}

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

    // Run background sync non-blocking so GET responds immediately
    void syncRecoveryTasksAndOrphans();

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
 * When task_type is VEHICLE_RECOVERY, also creates the linked MaintenanceTicket on the Ticket page,
 * updates the vehicle status to Blocked, and dispatches the Telegram alert.
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

    const cleanType = task_type.trim();
    const cleanDesc = description.trim();
    const cleanDriverName = driver_name ? driver_name.trim() : null;
    const cleanDriverPhone = driver_phone ? driver_phone.trim() : null;
    let resolvedVehicleId: string | null = vehicle_id || null;
    let resolvedPlate: string | null = plate_number ? plate_number.trim() : null;
    let finalLinkedTicketId: string | null = linked_ticket_id || null;

    // Resolve vehicle if VEHICLE_RECOVERY
    if (cleanType === "VEHICLE_RECOVERY") {
      const matchedVehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [
            ...(resolvedVehicleId ? [{ id: resolvedVehicleId }] : []),
            ...(resolvedPlate && resolvedPlate !== "Véhicule non assigné"
              ? [{ plate_number: resolvedPlate }]
              : []),
            ...(cleanDriverPhone ? [{ assigned_driver_phone: cleanDriverPhone }] : []),
            ...(cleanDriverName ? [{ assigned_driver_name: cleanDriverName }] : []),
          ],
        },
      }).catch(() => null);

      if (matchedVehicle) {
        resolvedVehicleId = matchedVehicle.id;
        resolvedPlate = matchedVehicle.plate_number;

        // Block vehicle in fleet
        await prisma.vehicle.update({
          where: { id: matchedVehicle.id },
          data: { status: "Blocked" },
        }).catch(() => {});
      }

      // Create or find the corresponding MaintenanceTicket on the Ticket Page (Support & Maintenance Kanban)
      if (!finalLinkedTicketId) {
        const existingOpenTicket = await prisma.maintenanceTicket.findFirst({
          where: {
            ticket_type: { in: ["VEHICLE_RECOVERY", "Vehicle Recovery"] },
            status: { in: ["OPEN", "IN_PROGRESS"] },
            OR: [
              ...(resolvedVehicleId ? [{ vehicle_id: resolvedVehicleId }] : []),
              ...(resolvedPlate && resolvedPlate !== "Véhicule non assigné"
                ? [{ plate_number: resolvedPlate }]
                : []),
              ...(cleanDriverPhone ? [{ driver_phone: cleanDriverPhone }] : []),
            ],
          },
        }).catch(() => null);

        if (existingOpenTicket) {
          finalLinkedTicketId = existingOpenTicket.id;
          await prisma.maintenanceTicket.update({
            where: { id: existingOpenTicket.id },
            data: {
              description: cleanDesc,
              priority: priority || "Critical",
              is_archived: false,
            },
          }).catch(() => {});
        } else {
          const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const createdTicket = await prisma.maintenanceTicket.create({
            data: {
              vehicle_id: resolvedVehicleId || "UNASSIGNED",
              plate_number: resolvedPlate || "Véhicule non assigné",
              driver_name: cleanDriverName,
              driver_phone: cleanDriverPhone,
              ticket_type: "VEHICLE_RECOVERY",
              description: cleanDesc,
              priority: priority || "Critical",
              status: "OPEN",
              sla_deadline: slaDeadline,
              is_archived: false,
            },
          });
          finalLinkedTicketId = createdTicket.id;
        }
      }
    }

    // Create or update the FieldTask on the Vehicle Recovery Page (Field Supervisor)
    let task;
    if (cleanType === "VEHICLE_RECOVERY") {
      const existingPendingTask = await prisma.fieldTask.findFirst({
        where: {
          task_type: "VEHICLE_RECOVERY",
          status: { in: ["PENDING", "IN_PROGRESS"] },
          OR: [
            ...(finalLinkedTicketId ? [{ linked_ticket_id: finalLinkedTicketId }] : []),
            ...(resolvedVehicleId ? [{ vehicle_id: resolvedVehicleId }] : []),
            ...(resolvedPlate && resolvedPlate !== "Véhicule non assigné"
              ? [{ plate_number: resolvedPlate }]
              : []),
            ...(cleanDriverPhone ? [{ driver_phone: cleanDriverPhone }] : []),
          ],
        },
      }).catch(() => null);

      if (existingPendingTask) {
        task = await prisma.fieldTask.update({
          where: { id: existingPendingTask.id },
          data: {
            vehicle_id: resolvedVehicleId || existingPendingTask.vehicle_id,
            plate_number: resolvedPlate || existingPendingTask.plate_number,
            driver_name: cleanDriverName || existingPendingTask.driver_name,
            driver_phone: cleanDriverPhone || existingPendingTask.driver_phone,
            description: cleanDesc,
            priority: priority || "Critical",
            linked_ticket_id: finalLinkedTicketId || existingPendingTask.linked_ticket_id,
          },
        });
      } else {
        task = await prisma.fieldTask.create({
          data: {
            task_type: cleanType,
            vehicle_id: resolvedVehicleId,
            plate_number: resolvedPlate,
            driver_name: cleanDriverName,
            driver_phone: cleanDriverPhone,
            description: cleanDesc,
            priority: priority || "Critical",
            linked_ticket_id: finalLinkedTicketId,
            due_date: due_date ? new Date(due_date) : null,
          },
        });
      }
    } else {
      task = await prisma.fieldTask.create({
        data: {
          task_type: cleanType,
          vehicle_id: resolvedVehicleId,
          plate_number: resolvedPlate,
          driver_name: cleanDriverName,
          driver_phone: cleanDriverPhone,
          description: cleanDesc,
          priority: priority || "Normal",
          linked_ticket_id: finalLinkedTicketId,
          due_date: due_date ? new Date(due_date) : null,
        },
      });
    }

    const session = await auth();
    const triggered_by = body.triggered_by || session?.user?.name || "Fleet Performance Manager";

    // Send instant Telegram notification to the Field Supervisor group (asynchronous, non-blocking)
    sendFieldTaskTelegramAlert({
      ...task,
      triggered_by,
    }).catch((err) =>
      console.error("Non-blocking Telegram alert error:", err)
    );

    // Touch sync state so Ticket page and Field Recovery page immediately refresh
    void touchSyncState("tickets");
    void touchSyncState("all");

    return NextResponse.json({ task, ticket_id: finalLinkedTicketId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/field-tasks error:", error);
    return NextResponse.json({ error: "Failed to create field task" }, { status: 500 });
  }
}

/**
 * DELETE /api/field-tasks
 * Bulk delete tasks by type and/or status (e.g. ?type=VEHICLE_RECOVERY or ?all=true)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const clearAll = searchParams.get("all") === "true";

    const where: any = {};
    if (type) where.task_type = type;
    if (status) where.status = status;

    if (!type && !status && !clearAll) {
      return NextResponse.json(
        { error: "Specify ?type, ?status, or ?all=true to delete tasks." },
        { status: 400 }
      );
    }

    const tasksToDelete = await prisma.fieldTask.findMany({
      where,
      select: { id: true, linked_ticket_id: true, task_type: true, vehicle_id: true, plate_number: true },
    });

    const ticketIdsToDelete = tasksToDelete
      .map((t) => t.linked_ticket_id)
      .filter((id): id is string => Boolean(id));

    if (ticketIdsToDelete.length > 0) {
      await prisma.maintenanceTicket.deleteMany({
        where: { id: { in: ticketIdsToDelete } },
      }).catch(() => {});
    }

    if (type === "VEHICLE_RECOVERY" || clearAll) {
      const plates = tasksToDelete
        .map((t) => t.plate_number)
        .filter((p): p is string => Boolean(p));
      if (plates.length > 0) {
        await prisma.maintenanceTicket.deleteMany({
          where: {
            plate_number: { in: plates },
            ticket_type: "VEHICLE_RECOVERY",
          },
        }).catch(() => {});
      }

      const vehicleIds = tasksToDelete
        .map((t) => t.vehicle_id)
        .filter((vid): vid is string => Boolean(vid));
      if (vehicleIds.length > 0) {
        await prisma.vehicle.updateMany({
          where: { id: { in: vehicleIds }, status: "Blocked" },
          data: { status: "Actif" },
        }).catch(() => {});
      }
    }

    const result = await prisma.fieldTask.deleteMany({ where });
    touchSyncState("tickets").catch(() => {});
    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    console.error("DELETE /api/field-tasks error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete field tasks" },
      { status: 500 }
    );
  }
}
