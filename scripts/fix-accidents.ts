import { prisma } from '../src/lib/prisma';

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'Accident' }
  });

  for (const vehicle of vehicles) {
    const existingClaim = await prisma.accidentClaim.findFirst({
      where: { vehicle_id: vehicle.id }
    });

    if (!existingClaim) {
      console.log(`Creating missing accident claim for vehicle ${vehicle.plate_number}...`);
      
      const driver = await prisma.driverProfile.findFirst({
        where: { assignedVehicleId: vehicle.id },
      });

      await prisma.accidentClaim.create({
        data: {
          vehicle_id: vehicle.id,
          driver_id: driver?.id || null,
          driver_name: vehicle.assigned_driver_name || driver?.fullName || null,
          driver_phone: vehicle.assigned_driver_phone || driver?.phoneSanitized || null,
          timeline_step: "NEW_ACCIDENT",
          severity: "HARD",
          step_updated_at: new Date(),
        },
      });
    }
  }

  console.log("Done fixing accidents!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
