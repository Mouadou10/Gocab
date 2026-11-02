import { prisma } from "../src/lib/prisma";
import { pushSqliteSnapshotNow } from "../src/lib/sqliteCloudSync";

async function main() {
  // Resolve stale duplicate ticket for 40839-Y-6
  await prisma.maintenanceTicket.updateMany({
    where: {
      plate_number: "40839-Y-6",
      status: "IN_PROGRESS",
    },
    data: {
      status: "RESOLVED",
      resolved_at: new Date("2026-10-30T16:27:45.339Z"),
      resolution_notes: "Véhicule réparé et remis en circulation.",
    },
  });

  // Set 40839-Y-6 back to Available and its claim to VEHICLE_BACK
  const v40839 = await prisma.vehicle.findFirst({
    where: { plate_number: "40839-Y-6" },
  });
  if (v40839) {
    await prisma.vehicle.update({
      where: { id: v40839.id },
      data: { status: "Available" },
    });
    await prisma.accidentClaim.updateMany({
      where: { vehicle_id: v40839.id },
      data: { timeline_step: "VEHICLE_BACK" },
    });
  }

  // Count active claims
  const activeClaims = await prisma.accidentClaim.findMany({
    where: {
      timeline_step: { not: "VEHICLE_BACK" },
    },
    include: {
      vehicle: true,
    },
  });

  console.log(`\n========================================`);
  console.log(`TOTAL ACTIVE ACCIDENT CLAIMS: ${activeClaims.length}`);
  console.log(`========================================`);
  activeClaims.forEach((c, idx) => {
    console.log(`${idx + 1}. Plate: ${c.vehicle?.plate_number} | Step: ${c.timeline_step} | Driver: ${c.driver_name}`);
  });

  // Push snapshot to Google Drive WAL
  await pushSqliteSnapshotNow("dev.db");
  console.log("\nDatabase synced and WAL flushed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
