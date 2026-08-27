import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";

/**
 * PATCH /api/vehicles/[id]
 * Updates vehicle metadata, mileage, status, and compliance dates.
 * Automations:
 *  - Accident status → auto-creates AccidentClaim
 *  - Mileage update ≥8,000 KM delta → auto-creates Urgent Vidange ticket
 *  - Actif→Available + driver unlinked → logs ChurnEvent (contract termination)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Snapshot vehicle state BEFORE update for churn detection
    const prevVehicle = await prisma.vehicle.findUnique({ where: { id } });
    const updateData: any = {};

    if (body.plate_number !== undefined) updateData.plate_number = body.plate_number.trim();
    if (body.make_model !== undefined) updateData.make_model = body.make_model.trim();
    if (body.year !== undefined) updateData.year = Number(body.year);
    if (body.vin !== undefined) updateData.vin = body.vin ? body.vin.trim() : null;
    if (body.current_mileage !== undefined) updateData.current_mileage = Number(body.current_mileage);
    if (body.hub_city !== undefined) updateData.hub_city = body.hub_city.trim();
    if (body.status !== undefined) updateData.status = body.status;

    if (body.insurance_expiry_date !== undefined) {
      updateData.insurance_expiry_date = body.insurance_expiry_date ? new Date(body.insurance_expiry_date) : null;
    }
    if (body.insurance_policy_number !== undefined) {
      updateData.insurance_policy_number = body.insurance_policy_number ? body.insurance_policy_number.trim() : null;
    }
    if (body.vignette_expiry_date !== undefined) {
      updateData.vignette_expiry_date = body.vignette_expiry_date ? new Date(body.vignette_expiry_date) : null;
    }
    if (body.autorisation_expiry_date !== undefined) {
      updateData.autorisation_expiry_date = body.autorisation_expiry_date ? new Date(body.autorisation_expiry_date) : null;
    }
    if (body.technical_inspection_expiry !== undefined) {
      updateData.technical_inspection_expiry = body.technical_inspection_expiry ? new Date(body.technical_inspection_expiry) : null;
    }

    if (body.assigned_driver_name !== undefined) updateData.assigned_driver_name = body.assigned_driver_name;
    if (body.assigned_driver_phone !== undefined) updateData.assigned_driver_phone = body.assigned_driver_phone;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.assigned_driver_id !== undefined) {
      if (body.assigned_driver_id) {
        // Link the driver profile to this vehicle
        await prisma.driverProfile.update({
          where: { id: body.assigned_driver_id },
          data: { assignedVehicleId: id }
        });
        
        // Fetch driver info to update denormalized fields on vehicle
        const driver = await prisma.driverProfile.findUnique({ where: { id: body.assigned_driver_id } });
        if (driver) {
          updateData.assigned_driver_name = driver.fullName;
          updateData.assigned_driver_phone = driver.phoneSanitized;
        }
      } else {
        // Unlink the driver
        const currentDriver = await prisma.driverProfile.findUnique({ where: { assignedVehicleId: id }});
        if (currentDriver) {
           await prisma.driverProfile.update({
             where: { id: currentDriver.id },
             data: { assignedVehicleId: null }
           });
        }
        updateData.assigned_driver_name = null;
        updateData.assigned_driver_phone = null;
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
    });

    // If status changed to Blocked, auto-create a MaintenanceTicket and linked FieldTask for physical recovery
    if (body.status === "Blocked" && prevVehicle?.status !== "Blocked") {
      const activeRecoveryTask = await prisma.fieldTask.findFirst({
        where: {
          vehicle_id: id,
          task_type: "VEHICLE_RECOVERY",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      });

      if (!activeRecoveryTask) {
        // Create ticket
        const ticket = await prisma.maintenanceTicket.create({
          data: {
            vehicle_id: id,
            plate_number: vehicle.plate_number,
            driver_name: vehicle.assigned_driver_name || null,
            driver_phone: vehicle.assigned_driver_phone || null,
            ticket_type: "VEHICLE_RECOVERY",
            description: body.blocked_reason || "Vehicle blocked by Fleet Performance Manager. Physical recovery required.",
            priority: "Urgent",
            status: "OPEN",
            sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        // Create linked FieldTask
        await prisma.fieldTask.create({
          data: {
            task_type: "VEHICLE_RECOVERY",
            vehicle_id: id,
            plate_number: vehicle.plate_number,
            driver_name: vehicle.assigned_driver_name || null,
            driver_phone: vehicle.assigned_driver_phone || null,
            description: `🚨 Vehicle Blocked: ${body.blocked_reason || "Physical recovery required by Field Supervisor"}`,
            priority: "Urgent",
            status: "PENDING",
            linked_ticket_id: ticket.id,
          },
        });
      }
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

        await prisma.accidentClaim.create({
          data: {
            vehicle_id: id,
            driver_id: driver?.id || null,
            driver_name: vehicle.assigned_driver_name || driver?.fullName || null,
            driver_phone: vehicle.assigned_driver_phone || driver?.phoneSanitized || null,
            timeline_step: "NEW_ACCIDENT",
            severity: "HARD",
            step_updated_at: new Date(),
          },
        });

        // Also create an urgent accident maintenance ticket
        await prisma.maintenanceTicket.create({
          data: {
            vehicle_id: id,
            plate_number: vehicle.plate_number,
            driver_name: vehicle.assigned_driver_name || driver?.fullName || null,
            driver_phone: vehicle.assigned_driver_phone || driver?.phoneSanitized || null,
            ticket_type: "Accident",
            description: `💥 Vehicle reported in Accident status. Repair & insurance workflow initiated.`,
            priority: "Urgent",
            status: "OPEN",
            sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        }).catch((e: any) => console.warn("Could not create accident maintenance ticket:", e));
      }
    }

    // ── Churn Detection: Actif → Available + Driver Unlinked ────────────────
    // When Fleet Perf Manager terminates a contract, they set vehicle to Available
    // and unlink the driver. This transition is the definition of churn.
    if (
      body.status === "Available" &&
      prevVehicle &&
      (prevVehicle.status === "Actif") &&
      prevVehicle.assigned_driver_name
    ) {
      await prisma.churnEvent.create({
        data: {
          vehicle_id: id,
          plate_number: vehicle.plate_number,
          driver_name: prevVehicle.assigned_driver_name,
          driver_phone: prevVehicle.assigned_driver_phone,
          reason: body.churn_reason || null,
        },
      }).catch((e: any) => console.warn("Failed to log ChurnEvent:", e));
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Predictive Maintenance: 8,000 KM Vidange Auto-Trigger ───────────────

    // When mileage is updated and the delta from lastVidangeOdoKM >= 8,000 KM,
    // auto-create an Urgent Vidange ticket and reset the lastVidangeOdoKM counter.
    if (body.current_mileage !== undefined) {
      const currentMileage = Number(body.current_mileage);
      const lastVidange = vehicle.lastVidangeOdoKM || 0;
      const delta = currentMileage - lastVidange;

      if (delta >= 8000) {
        const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.maintenanceTicket.create({
          data: {
            vehicle_id: id,
            plate_number: vehicle.plate_number,
            driver_name: vehicle.assigned_driver_name,
            driver_phone: vehicle.assigned_driver_phone,
            ticket_type: "Vidange",
            description: `⚙️ Auto-trigger: Vehicle has reached ${delta.toLocaleString()} KM since last oil change (current: ${currentMileage.toLocaleString()} KM). Vidange required immediately.`,
            priority: "Urgent",
            status: "OPEN",
            sla_deadline: slaDeadline,
          },
        });
        // Reset the vidange odometer checkpoint
        await prisma.vehicle.update({
          where: { id },
          data: { lastVidangeOdoKM: currentMileage },
        });
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    return NextResponse.json({ vehicle });

  } catch (error) {
    console.error("PATCH /api/vehicles/[id] error:", error);
    const authResp = (() => { try { return handleAuthError(error); } catch { return null; } })();
    if (authResp) return authResp;
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vehicles/[id]
 * Deletes a vehicle and all related records (cascade).
 * SQLite does not support onDelete: Cascade in this schema, so we
 * manually delete child records in the correct FK order first.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    // Wrap in a transaction so partial deletes don't leave orphans
    await prisma.$transaction(async (tx) => {
      // 1. Unlink any DriverProfile assigned to this vehicle
      await tx.driverProfile.updateMany({
        where: { assignedVehicleId: id },
        data: { assignedVehicleId: null },
      });

      // 2. Delete SupportTickets linked to this vehicle
      await tx.supportTicket.deleteMany({
        where: { vehicleId: id },
      });

      // 3. Delete FieldInspections linked to this vehicle
      await tx.fieldInspectionNew.deleteMany({
        where: { vehicleId: id },
      });

      // 4. Delete AccidentClaims linked to this vehicle
      await tx.accidentClaim.deleteMany({
        where: { vehicle_id: id },
      });

      // 5. Delete MaintenanceTickets linked to this vehicle
      await tx.maintenanceTicket.deleteMany({
        where: { vehicle_id: id },
      });

      // 6. Delete ChurnEvents linked to this vehicle
      await tx.churnEvent.deleteMany({
        where: { vehicle_id: id },
      });

      // 7. Delete expenses linked to this vehicle
      await tx.vehicleExpense.deleteMany({
        where: { vehicle_id: id },
      });

      // 8. Finally delete the vehicle itself
      await tx.vehicle.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/vehicles/[id] error:", error);
    const authResp = (() => { try { return handleAuthError(error); } catch { return null; } })();
    if (authResp) return authResp;
    return NextResponse.json(
      { error: "Failed to delete vehicle. It may have related records that could not be removed." },
      { status: 500 }
    );
  }
}
