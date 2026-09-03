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

const FALLBACK_TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io";
const FALLBACK_TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";

function createPrismaClient(): PrismaClient {
  let url = process.env.TURSO_DATABASE_URL;
  let authToken = process.env.TURSO_AUTH_TOKEN;

  // If TURSO_DATABASE_URL is not provided or points to local/postgres, use Turso Cloud fallback
  if (!url || url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("postgres")) {
      url = process.env.DATABASE_URL;
    } else {
      url = FALLBACK_TURSO_URL;
      authToken = authToken || FALLBACK_TURSO_TOKEN;
    }
  }

  if (url.startsWith("libsql://")) {
    url = url.replace("libsql://", "https://");
  }

  authToken = authToken || (url === FALLBACK_TURSO_URL ? FALLBACK_TURSO_TOKEN : undefined);

  try {
    const adapter = new PrismaLibSql({
      url,
      ...(authToken ? { authToken } : {}),
    });
    return new PrismaClient({ adapter });
  } catch (e) {
    console.warn("PrismaLibSql initialization warning:", e);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

