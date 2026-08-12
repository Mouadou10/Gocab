import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/vehicles/[id]
 * Updates vehicle metadata, mileage, status, and compliance dates.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

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

    // If status changed to Accident, auto-create an AccidentClaim if one doesn't exist active
    if (body.status === "Accident") {
      const activeClaim = await prisma.accidentClaim.findFirst({
        where: { 
          vehicle_id: id,
          timeline_step: { not: "VEHICLE_BACK" }
        }
      });
      if (!activeClaim) {
        // Find driver info if available
        let driver_id = null;
        let driver_name = vehicle.assigned_driver_name;
        let driver_phone = vehicle.assigned_driver_phone;

        const profile = await prisma.driverProfile.findUnique({ where: { assignedVehicleId: id } });
        if (profile) {
          driver_id = profile.id;
          driver_name = profile.fullName;
          driver_phone = profile.phoneSanitized;
        }

        await prisma.accidentClaim.create({
          data: {
            vehicle_id: id,
            driver_id,
            driver_name,
            driver_phone,
          }
        });
      }
    }

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error("PATCH /api/vehicles/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vehicles/[id]
 * Deletes a vehicle record from the database.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.vehicle.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/vehicles/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete vehicle" },
      { status: 500 }
    );
  }
}
