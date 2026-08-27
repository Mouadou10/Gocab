/**
 * Prisma Client Singleton (LibSQL / Turso Version)
 *
 * Uses @prisma/adapter-libsql configured with Turso Cloud database.
 * Works seamlessly on Vercel serverless and locally.
 *
 * Credentials are read ONLY from environment variables:
 *   TURSO_DATABASE_URL or DATABASE_URL
 *   TURSO_AUTH_TOKEN (required for Turso Cloud)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  let url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "Missing database URL. Set TURSO_DATABASE_URL or DATABASE_URL in your .env.local file."
    );
  }

  if (url.startsWith("libsql://")) {
    url = url.replace("libsql://", "https://");
  }

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

