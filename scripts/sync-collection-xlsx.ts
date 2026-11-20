import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/collections/upload-balance/route";
import { prisma, flushDatabaseSync } from "../src/lib/prisma";

function parseArgs() {
  const args = process.argv.slice(2);
  let mode: "MORNING" | "EVENING" = "MORNING";
  let date = new Date().toISOString().split("T")[0];
  let filePath = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode" && args[i + 1]) {
      const m = args[++i].toUpperCase();
      if (m === "MORNING" || m === "EVENING") mode = m;
    } else if (args[i] === "--date" && args[i + 1]) {
      date = args[++i];
    } else if (!args[i].startsWith("--")) {
      filePath = args[i];
    }
  }

  return { mode, date, filePath };
}

async function main() {
  const { mode, date, filePath } = parseArgs();

  if (!filePath || !fs.existsSync(filePath)) {
    console.error("Usage: node --import tsx scripts/sync-collection-xlsx.ts --mode <MORNING|EVENING> [--date YYYY-MM-DD] <path-to-xlsx>");
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const file = new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  formData.append("date", date);

  const req = new NextRequest("http://localhost:3000/api/collections/upload-balance", {
    method: "POST",
    body: formData,
  });

  const res = await POST(req);
  const json = await res.json();

  console.log(`COLLECTION SYNC [${mode}] (${date}) STATUS:`, res.status);
  console.log(JSON.stringify(json.summary || json, null, 2));

  if (res.status !== 200) {
    process.exit(1);
  }

  // Ensure Cloud WAL snapshot is flushed before exiting CLI script
  await flushDatabaseSync().catch(() => {});
}

main()
  .catch((err) => {
    console.error("Collection sync failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
