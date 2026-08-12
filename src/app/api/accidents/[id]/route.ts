import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, context: any) {
  const params = await context.params;
  const { id } = params;
  
  try {
    const claim = await prisma.accidentClaim.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: true,
      },
    });
    
    if (!claim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, claim });
  } catch (error: any) {
    console.error("Error fetching accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: any) {
  const params = await context.params;
  const { id } = params;
  
  try {
    const body = await req.json();
    
    const currentClaim = await prisma.accidentClaim.findUnique({ where: { id } });
    if (!currentClaim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (body.severity !== undefined) updateData.severity = body.severity;
    if (body.fault !== undefined) updateData.fault = body.fault;
    
    let isStatusChange = false;
    if (body.timeline_step && body.timeline_step !== currentClaim.timeline_step) {
      updateData.timeline_step = body.timeline_step;
      updateData.step_updated_at = new Date();
      isStatusChange = true;
    }

    const updatedClaim = await prisma.accidentClaim.update({
      where: { id },
      data: updateData,
    });

    // Integration Logic: If it moved to READY_FOR_PICKUP, create a FieldTask
    if (isStatusChange && updatedClaim.timeline_step === 'READY_FOR_PICKUP') {
      await prisma.fieldTask.create({
        data: {
          task_type: "GARAGE_PICKUP",
          vehicle_id: updatedClaim.vehicle_id,
          plate_number: currentClaim.vehicle_id, // We'll look up the actual plate
          driver_name: updatedClaim.driver_name,
          driver_phone: updatedClaim.driver_phone,
          description: `Garage pickup for repaired vehicle (Accident Claim)`,
          linked_ticket_id: updatedClaim.id, // We use the accident claim ID as the linked ticket
          status: "PENDING",
          priority: "Urgent",
        }
      });
      
      // Let's ensure the plate number is correct by updating it after creation
      const vehicle = await prisma.vehicle.findUnique({ where: { id: updatedClaim.vehicle_id } });
      if (vehicle) {
        await prisma.fieldTask.updateMany({
          where: { linked_ticket_id: updatedClaim.id, task_type: "GARAGE_PICKUP" },
          data: { plate_number: vehicle.plate_number }
        });
      }
    }

    return NextResponse.json({ success: true, claim: updatedClaim });
  } catch (error: any) {
    console.error("Error updating accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: any) {
  const params = await context.params;
  const { id } = params;
  
  try {
    await prisma.accidentClaim.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
