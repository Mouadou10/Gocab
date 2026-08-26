/**
 * Prisma Client Singleton (LibSQL / Turso Version)
 *
 * Uses @prisma/adapter-libsql which works on both local development (file:./dev.db)
 * and Vercel serverless (Turso hosted SQLite).
 *
 * In Prisma v7, PrismaLibSql is a factory that takes { url, authToken } directly.
 *
 * Prevents multiple Prisma Client instances in development
 * (Next.js hot-reloading creates new modules each time).
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const adapter = new PrismaLibSql({
    url,
    ...(authToken ? { authToken } : {}),
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
