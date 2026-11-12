import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { prisma } from "../src/lib/prisma";

async function main() {
  const latest = await prisma.lead.findMany({
    where: { campaign_source: "Google Sheets Import" },
    take: 5,
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      raw_name: true,
      sanitized_phone: true,
      city: true,
      board_column: true,
      campaign_source: true,
      created_at: true,
    },
  });
  console.log("Sample newly imported leads:", latest);

  const totalImported = await prisma.lead.count({
    where: { campaign_source: "Google Sheets Import" },
  });
  console.log("Total Google Sheets Import leads in DB:", totalImported);

  const newLeadsTotal = await prisma.lead.count({
    where: { board_column: "NEW_LEADS" },
  });
  console.log("Total NEW_LEADS in CRM:", newLeadsTotal);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
