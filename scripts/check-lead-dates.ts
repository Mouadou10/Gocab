import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function run() {
  const dates = await prisma.$queryRawUnsafe(`
    SELECT substr(status_changed_at, 1, 10) as day, count(*) as count
    FROM Lead
    WHERE status_changed_at IS NOT NULL
    GROUP BY day
    ORDER BY day DESC
    LIMIT 20;
  `);
  console.log("Status changed at by day:", dates);
}
run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
