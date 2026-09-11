import { prisma } from "../prisma";
import { logAudit } from "./auditLogger";

export async function processVehicleSideEffects(
  id: string,
  body: any,
  prevVehicle: any,
  updatedVehicle: any,
  userId: string
) {
  // If status changed to Blocked, log audit. Vehicle recovery FieldTask is only created manually by performance agent from collection page.
  if (body.status === "Blocked" && prevVehicle?.status !== "Blocked") {
    await logAudit({
      userId,
      action: "UPDATE",
      entityType: "Vehicle",
      entityId: id,
      changes: { status: "Blocked", reason: body.blocked_reason || "Vehicle marked as Blocked" },
    });
  }

  // If status changed to Accident, auto-create BOTH AccidentClaim (Assurance) AND MaintenanceTicket (Support)
  const isAccidentStatus = body.status === "Accident" || body.status === "Accidenté" || (typeof body.status === "string" && body.status.toLowerCase().includes("acc"));
  const wasAccidentStatus = prevVehicle?.status === "Accident" || prevVehicle?.status === "Accidenté" || (typeof prevVehicle?.status === "string" && prevVehicle?.status.toLowerCase().includes("acc"));

  if (isAccidentStatus && !wasAccidentStatus) {
    let driver = await prisma.driverProfile.findFirst({
      where: { assignedVehicleId: id },
    });
    if (!driver && updatedVehicle.assigned_driver_name) {
      driver = await prisma.driverProfile.findFirst({
        where: { fullName: { contains: updatedVehicle.assigned_driver_name.trim() } },
      }).catch(() => null);
    }

    const driverName = updatedVehicle.assigned_driver_name || driver?.fullName || null;
    const driverPhone = updatedVehicle.assigned_driver_phone || driver?.phoneSanitized || null;

    // 1. Assurance Ticket (AccidentClaim in Insurance & Accidents page)
    const existingClaim = await prisma.accidentClaim.findFirst({
      where: {
        vehicle_id: id,
        timeline_step: { not: "VEHICLE_BACK" },
      },
    });

    if (!existingClaim) {
      const claim = await prisma.accidentClaim.create({
        data: {
          vehicle_id: id,
          driver_id: driver?.id || null,
          driver_name: driverName,
          driver_phone: driverPhone,
          timeline_step: "NEW_ACCIDENT",
          severity: "HARD",
          step_updated_at: new Date(),
          comments: JSON.stringify([
            {
              id: crypto.randomUUID(),
              timeline_step: "NEW_ACCIDENT",
              comment: "Dossier accident ouvert automatiquement suite au passage en statut Accidenté sur la page Flotte.",
              author: "Agent Flotte",
              created_at: new Date().toISOString(),
            },
          ]),
        },
      });

      await logAudit({
        userId,
        action: "CREATE",
        entityType: "AccidentClaim",
        entityId: claim.id,
        changes: { reason: "STATUS_CHANGED_TO_ACCIDENT" },
      });
    }

    // 2. Support Ticket (MaintenanceTicket in Driver Support Kanban page)
    const existingTicket = await prisma.maintenanceTicket.findFirst({
      where: {
        vehicle_id: id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    });

    if (!existingTicket) {
      await prisma.maintenanceTicket.create({
        data: {
          vehicle_id: id,
          plate_number: updatedVehicle.plate_number,
          driver_name: driverName,
          driver_phone: driverPhone,
          ticket_type: "Accident",
          description: `💥 Véhicule passé en statut Accidenté depuis la page Flotte. Prise en charge mécanique & assurance requise.`,
          priority: "Urgent",
          status: "OPEN",
          sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }).catch((e: any) => console.warn("Could not create accident maintenance ticket:", e));
    }
  }

  // If status changed from Accident to Actif or Available, auto-resolve both
  if ((body.status === "Actif" || body.status === "Available") && wasAccidentStatus) {
    await prisma.accidentClaim.updateMany({
      where: {
        vehicle_id: id,
        timeline_step: { not: "VEHICLE_BACK" },
      },
      data: {
        timeline_step: "VEHICLE_BACK",
        step_updated_at: new Date(),
      },
    }).catch(() => {});

    await prisma.maintenanceTicket.updateMany({
      where: {
        vehicle_id: id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        ticket_type: "Accident",
      },
      data: {
        status: "RESOLVED",
        resolved_at: new Date(),
        resolution_notes: `Résolu automatiquement : Véhicule remis en statut "${body.status}" depuis la page Flotte.`,
      },
    }).catch(() => {});
  }

  // ── Churn Detection: Actif → Available + Driver Unlinked
  if (
    body.status === "Available" &&
    prevVehicle &&
    (prevVehicle.status === "Actif") &&
    prevVehicle.assigned_driver_name
  ) {
    const churn = await prisma.churnEvent.create({
      data: {
        vehicle_id: id,
        plate_number: updatedVehicle.plate_number,
        driver_name: prevVehicle.assigned_driver_name,
        driver_phone: prevVehicle.assigned_driver_phone,
        reason: body.churn_reason || null,
      },
    }).catch((e: any) => console.warn("Failed to log ChurnEvent:", e));
    if (churn) {
      await logAudit({
        userId,
        action: "CREATE",
        entityType: "ChurnEvent",
        entityId: churn.id,
        changes: { reason: body.churn_reason || "Actif -> Available driver unlinked" },
      });
    }
  }

  // ── Predictive Maintenance: 8,000 KM Vidange Auto-Trigger
  if (body.current_mileage !== undefined) {
    const currentMileage = Number(body.current_mileage);
    const lastVidange = updatedVehicle.lastVidangeOdoKM || 0;
    const delta = currentMileage - lastVidange;

    if (delta >= 8000) {
      const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const vidange = await prisma.maintenanceTicket.create({
        data: {
          vehicle_id: id,
          plate_number: updatedVehicle.plate_number,
          driver_name: updatedVehicle.assigned_driver_name,
          driver_phone: updatedVehicle.assigned_driver_phone,
          ticket_type: "Vidange",
          description: `⚙️ Auto-trigger: Vehicle has reached ${delta.toLocaleString()} KM since last oil change (current: ${currentMileage.toLocaleString()} KM). Vidange required immediately.`,
          priority: "Urgent",
          status: "OPEN",
          sla_deadline: slaDeadline,
        },
      });
      await logAudit({
        userId,
        action: "CREATE",
        entityType: "MaintenanceTicket",
        entityId: vidange.id,
        changes: { type: "AUTO_VIDANGE", delta },
      });

      await prisma.vehicle.update({
        where: { id },
        data: { lastVidangeOdoKM: currentMileage },
      });
    }
  }
}
