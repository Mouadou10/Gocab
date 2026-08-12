import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Find all vehicles where current mileage is >= 8000 km more than last vidange
    const vehiclesNeedingVidange = await prisma.vehicle.findMany({
      where: {
        // Unfortunately, Prisma SQLite doesn't support complex math in where clauses easily
        // We'll fetch active vehicles and filter in memory since fleet is small (< 1000)
        status: "ACTIF"
      }
    });

    const overdueVehicles = vehiclesNeedingVidange.filter(
      v => v.current_mileage - v.lastVidangeOdoKM >= 8000
    );

    const generatedTickets = [];

    for (const vehicle of overdueVehicles) {
      // Check if there is already an open vidange ticket
      const existingTicket = await prisma.supportTicket.findFirst({
        where: {
          vehicleId: vehicle.id,
          category: "VIDANGE",
          status: "OPEN"
        }
      });

      if (!existingTicket) {
        // Change vehicle status to WARNING via Risk Level logic (we'll just create the ticket for now)
        // Dashboard will read the risk level dynamically from the DB based on mileage
        
        // Find driver
        const driver = await prisma.driverProfile.findUnique({
          where: { assignedVehicleId: vehicle.id }
        });

        if (driver) {
          const ticket = await prisma.supportTicket.create({
            data: {
              ticketNumber: `VID-${Date.now()}-${vehicle.plate_number}`,
              category: "VIDANGE",
              status: "OPEN",
              description: `Automated Trigger: Vehicle has reached ${vehicle.current_mileage} KM. Vidange is due (Last vidange at ${vehicle.lastVidangeOdoKM} KM).`,
              driverId: driver.id,
              vehicleId: vehicle.id,
            }
          });
          generatedTickets.push(ticket);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Processed ${generatedTickets.length} predictive maintenance tickets.` 
    });

  } catch (error) {
    console.error("Predictive Maintenance Cron Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
