import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function run() {
  const settings = await prisma.setting.findMany();
  console.log("Settings in dev.db:");
  for (const s of settings) {
    console.log(`  ${s.key}: ${s.value.slice(0, 80)}`);
  }
  const leadsCount = await prisma.lead.count();
  console.log("Total leads in dev.db:", leadsCount);
  const byCol = await prisma.lead.groupBy({
    by: ["board_column"],
    _count: true,
  });
  console.log("By col:", byCol);
}
run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
