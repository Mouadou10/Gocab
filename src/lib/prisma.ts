/**
 * Prisma Client Singleton — Single Source of Truth Architecture
 *
 * Connects directly to the durable database via @prisma/adapter-libsql:
 * - Production on Vercel: Connects to hosted database via TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.
 * - Local Development / CI: Connects directly to local SQLite database (dev.db).
 *
 * Eliminates ephemeral /tmp SQLite failover and whole-file cloud synchronization,
 * preventing race conditions, split-brain state, and SQLite disk image corruption.
 */

import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function loadEnvLocalIfAvailable() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) return;
  try {
    const candidates = [
      path.join(process.cwd(), ".env.local"),
      path.resolve(".env.local"),
    ];
    for (const envFile of candidates) {
      if (fs.existsSync(envFile)) {
        const content = fs.readFileSync(envFile, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx !== -1) {
              const k = trimmed.slice(0, eqIdx).trim();
              const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, "$1");
              if (!process.env[k]) {
                process.env[k] = v;
              }
            }
          }
        }
        break;
      }
    }
  } catch {}
}

function resolveDatabaseUrl(): { url: string; isRemote: boolean; authToken?: string } {
  loadEnvLocalIfAvailable();
  const envUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  if (envUrl && (envUrl.startsWith("libsql://") || envUrl.startsWith("https://"))) {
    return {
      url: envUrl.replace("libsql://", "https://").replace(/\/$/, ""),
      isRemote: true,
      authToken,
    };
  }

  if (envUrl && envUrl.startsWith("file:")) {
    return {
      url: envUrl,
      isRemote: false,
    };
  }

  // Default to local SQLite dev.db in project root
  const candidates = [
    path.join(process.cwd(), "dev.db"),
    path.resolve("dev.db"),
  ];
  const dbFile = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || path.join(process.cwd(), "dev.db");

  return {
    url: `file:${dbFile.replace(/\\/g, "/")}`,
    isRemote: false,
  };
}

function createPrismaClient(): PrismaClient {
  const { url, isRemote, authToken } = resolveDatabaseUrl();

  const adapter = new PrismaLibSql({
    url,
    ...(isRemote && authToken ? { authToken } : {}),
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Compatibility helpers (no-ops in durable hosted database architecture)
 */
export async function ensureDatabaseSynced(_force?: boolean): Promise<void> {
  // Durable database architecture maintains single source of truth; no local replay needed.
}

export async function flushDatabaseSync(): Promise<void> {
  // Durable database architecture commits directly over connection; no file sync needed.
}

export function isSqliteCorruptError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err || "");
  const code = String(err?.code || (err as any)?.rawCode || "");
  return (
    code === "11" ||
    code === "SQLITE_CORRUPT" ||
    msg.includes("SQLITE_CORRUPT") ||
    msg.includes("database disk image is malformed")
  );
}

export function recoverCorruptDatabase(): PrismaClient {
  console.warn("[Database] Recovery requested — returning active Prisma singleton");
  return prisma;
}
