const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.vehicle.findMany({ where: { status: 'Accident' } });
  
  for (const v of vehicles) {
    const claim = await prisma.accidentClaim.findFirst({ where: { vehicle_id: v.id } });
    
    if (!claim) {
      let d_id = null;
      let d_name = v.assigned_driver_name || null;
      let d_phone = v.assigned_driver_phone || null;
      
      const p = await prisma.driverProfile.findUnique({ where: { assignedVehicleId: v.id } });
      if(p) {
        d_id = p.id;
        d_name = p.fullName;
        d_phone = p.phoneSanitized;
      }
      
      await prisma.accidentClaim.create({
        data: {
          vehicle_id: v.id,
          driver_id: d_id,
          driver_name: d_name,
          driver_phone: d_phone,
        }
      });
      console.log('Created missing claim for', v.plate_number);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
