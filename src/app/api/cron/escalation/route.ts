import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // 1. Fetch drivers with active arrears
    // We assume currentArrearsMAD > 0 means they are in default
    const driversInDefault = await prisma.driverProfile.findMany({
      where: {
        currentArrearsMAD: { gt: 0 }
      },
      include: { assignedVehicle: true }
    });

    let updatedCount = 0;

    for (const driver of driversInDefault) {
      let nextStage = driver.defaultStage;

      // Simple mock logic for stage progression
      // In production, this would use timestamps to check if 24h/48h has elapsed
      if (driver.defaultStage === "NOMINAL") {
        nextStage = "DAY_1_WARNING";
      } else if (driver.defaultStage === "DAY_1_WARNING") {
        nextStage = "DAY_2_FINAL_DEMAND";
      } else if (driver.defaultStage === "DAY_2_FINAL_DEMAND") {
        nextStage = "TELEMATIC_BLOCK_EXECUTED";
        
        // Mock API call to telematics provider to block engine
        console.log(`[TELEMATICS API] Issuing remote engine block for vehicle ${driver.assignedVehicle?.plate_number}`);
        
        // Generate a recovery task for Senior Field Supervisor
        if (driver.assignedVehicle) {
          await prisma.fieldTask.create({
            data: {
              task_type: "VEHICLE_RECOVERY",
              vehicle_id: driver.assignedVehicle.id,
              plate_number: driver.assignedVehicle.plate_number,
              driver_name: driver.fullName,
              driver_phone: driver.phoneSanitized,
              description: `Automated Recovery Dispatch: Driver ${driver.fullName} exceeded 48-hour default threshold. Telematic block executed. Recover asset immediately.`,
              priority: "Critical",
              status: "PENDING"
            }
          });
        }
      }

      if (nextStage !== driver.defaultStage) {
        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: { defaultStage: nextStage }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Processed ${updatedCount} escalation state changes.` 
    });

  } catch (error) {
    console.error("Escalation Cron Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
