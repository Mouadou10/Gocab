const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const url = 'https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ';

const adapter = new PrismaLibSql({ url, authToken });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Searching for vehicles without fleet manager...');
  const unassignedVehicles = await prisma.vehicle.findMany({
    where: {
      is_archived: false,
      OR: [
        { assigned_collector: null },
        { assigned_collector: '' },
        { assigned_supervisor: null },
        { assigned_supervisor: '' },
      ]
    },
    select: { id: true, plate_number: true, assigned_driver_name: true, assigned_collector: true, assigned_supervisor: true }
  });

  console.log(`Found ${unassignedVehicles.length} vehicles without complete fleet manager assignment:`);
  for (const v of unassignedVehicles) {
    console.log(`  - ${v.plate_number} (Driver: ${v.assigned_driver_name || 'None'}) | Collector: "${v.assigned_collector}" | Supervisor: "${v.assigned_supervisor}"`);
  }

  // Update all unassigned to Mohamed Aziz
  const updated = await prisma.vehicle.updateMany({
    where: {
      is_archived: false,
      OR: [
        { assigned_collector: null },
        { assigned_collector: '' },
        { assigned_collector: 'unassigned' },
      ]
    },
    data: {
      assigned_collector: 'Mohamed Aziz',
      assigned_supervisor: 'Mohamed Aziz',
    }
  });

  console.log(`Successfully updated ${updated.count} vehicles to Mohamed Aziz!`);
}

main().catch(console.error).finally(() => process.exit(0));
