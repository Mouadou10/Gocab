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

    // Import the vehicle service and audit logger at the top of the file (added in next chunk if needed)
    
    // Process Side-effects
    const { processVehicleSideEffects } = require("@/lib/services/vehicleService");
    // We assume the user ID is retrieved from auth or fallback
    const userId = "ops_manager"; // In a real setup, extract from session
    
    await processVehicleSideEffects(id, body, prevVehicle, vehicle, userId);
    
    // Log the update
    const { logAudit } = require("@/lib/services/auditLogger");
    await logAudit({
      userId,
      action: "UPDATE",
      entityType: "Vehicle",
      entityId: vehicle.id,
      changes: updateData,
    });

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
 * Soft deletes a vehicle and unlinks assigned driver.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    // Wrap in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Unlink any DriverProfile assigned to this vehicle
      await tx.driverProfile.updateMany({
        where: { assignedVehicleId: id },
        data: { assignedVehicleId: null },
      });

      // 2. Soft delete the vehicle itself
      await tx.vehicle.update({
        where: { id },
        data: { 
          is_archived: true, 
          assigned_driver_name: null,
          assigned_driver_phone: null,
          status: "Archived"
        },
      });
      
      // Log audit
      const { logAudit } = require("@/lib/services/auditLogger");
      await logAudit({
        userId: "ops_manager",
        action: "ARCHIVE",
        entityType: "Vehicle",
        entityId: id,
        changes: { status: "Archived", unlinked_driver: true },
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
