import fs from "node:fs";
import path from "node:path";
import { ingestVehiclesFile } from "../src/lib/services/vehicleImportService";
import { prisma } from "../src/lib/prisma";

async function main() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error("Usage: node --import tsx scripts/sync-fleet-xlsx.ts <path-to-xlsx>");
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const file = new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const result = await ingestVehiclesFile(file);
  console.log("SYNC STATUS:", result.status);
  console.log(JSON.stringify(result.body, null, 2));

  if (result.status !== 200) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
