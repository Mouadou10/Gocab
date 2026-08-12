/**
 * Prisma Client Singleton (SQLite Version)
 *
 * For SQLite in Prisma v7, we use `@prisma/adapter-better-sqlite3` with `better-sqlite3`.
 *
 * Prevents multiple Prisma Client instances in development
 * (Next.js hot-reloading creates new modules each time).
 */

import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbPath = path.join(process.cwd(), "dev.db");
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
