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

  // If status changed to Accident, auto-create an AccidentClaim
  if (body.status === "Accident" && prevVehicle?.status !== "Accident") {
    const existingClaim = await prisma.accidentClaim.findFirst({
      where: {
        vehicle_id: id,
        timeline_step: { not: "VEHICLE_BACK" },
      },
    });

    if (!existingClaim) {
      const driver = await prisma.driverProfile.findFirst({
        where: { assignedVehicleId: id },
      });

      const claim = await prisma.accidentClaim.create({
        data: {
          vehicle_id: id,
          driver_id: driver?.id || null,
          driver_name: updatedVehicle.assigned_driver_name || driver?.fullName || null,
          driver_phone: updatedVehicle.assigned_driver_phone || driver?.phoneSanitized || null,
          timeline_step: "NEW_ACCIDENT",
          severity: "HARD",
          step_updated_at: new Date(),
        },
      });

      await logAudit({
        userId,
        action: "CREATE",
        entityType: "AccidentClaim",
        entityId: claim.id,
        changes: { reason: "STATUS_CHANGED_TO_ACCIDENT" },
      });

      await prisma.maintenanceTicket.create({
        data: {
          vehicle_id: id,
          plate_number: updatedVehicle.plate_number,
          driver_name: updatedVehicle.assigned_driver_name || driver?.fullName || null,
          driver_phone: updatedVehicle.assigned_driver_phone || driver?.phoneSanitized || null,
          ticket_type: "Accident",
          description: `💥 Vehicle reported in Accident status. Repair & insurance workflow initiated.`,
          priority: "Urgent",
          status: "OPEN",
          sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }).catch((e: any) => console.warn("Could not create accident maintenance ticket:", e));
    }
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
