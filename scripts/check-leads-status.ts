import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function check() {
  const total = await prisma.lead.count();
  const byCol = await prisma.lead.groupBy({ by: ["board_column"], _count: true });
  const byBrandStatus = await prisma.lead.groupBy({ by: ["brand_status"], _count: true });
  const recent = await prisma.lead.findMany({
    orderBy: { created_at: "desc" },
    take: 10,
    select: { id: true, raw_name: true, board_column: true, brand_status: true, created_at: true, status_changed_at: true }
  });
  console.log("Total leads:", total);
  console.log("By board_column:", byCol);
  console.log("By brand_status:", byBrandStatus);
  console.log("Most recent 10 leads:", recent);

  const newLeads = await prisma.lead.findMany({
    where: { board_column: "NEW_LEADS" },
    take: 10,
    select: { id: true, raw_name: true, board_column: true, brand_status: true, created_at: true, status_changed_at: true }
  });
  console.log("New leads count:", newLeads.length, "samples:", newLeads);

  await prisma.$disconnect();
}

check().catch(console.error);
