/**
 * Prisma Client Singleton (LibSQL / Turso Version with Local SQLite Failover)
 *
 * Uses @prisma/adapter-libsql configured with Turso Cloud database.
 * Automatically fails over to the bundled local SQLite replica (dev.db)
 * if Turso Cloud blocks SQL operations (e.g. row-read quota limit) or is unreachable.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  primaryPrisma: PrismaClient | undefined;
  fallbackPrisma: PrismaClient | undefined;
  tursoBlockedUntil: number | undefined;
};

const PRODUCTION_TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io";
const PRODUCTION_TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";

function resolveTursoConfig(): { url: string; authToken: string } {
  const envUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "";
  const envToken = process.env.TURSO_AUTH_TOKEN || "";

  // Allow switching to a custom/upgraded Turso DB via env vars, while ignoring stale dead URLs
  if (
    envUrl &&
    (envUrl.startsWith("libsql://") || envUrl.startsWith("https://")) &&
    !envUrl.includes("restored") &&
    !envUrl.includes("mouadou123-3668") &&
    envToken
  ) {
    return {
      url: envUrl.replace("libsql://", "https://").replace(/\/$/, ""),
      authToken: envToken,
    };
  }

  return {
    url: PRODUCTION_TURSO_URL,
    authToken: PRODUCTION_TURSO_TOKEN,
  };
}

function getPrimaryClient(): PrismaClient {
  if (globalForPrisma.primaryPrisma) {
    return globalForPrisma.primaryPrisma;
  }
  const { url, authToken } = resolveTursoConfig();
  const adapter = new PrismaLibSql({ url, authToken });
  const client = new PrismaClient({ adapter });
  globalForPrisma.primaryPrisma = client;
  return client;
}

function getFallbackSqliteUrl(): string {
  const candidates = [
    path.join(process.cwd(), "dev.db"),
    path.resolve("dev.db"),
  ];
  const srcPath = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || path.join(process.cwd(), "dev.db");

  // On Vercel serverless, the deployment bundle directory (/var/task) is read-only.
  // Copy dev.db once to /tmp/gocab-dev.db so both reads AND writes work seamlessly.
  if (process.env.VERCEL || process.cwd().startsWith("/var/task")) {
    try {
      const tmpDbPath = path.join(os.tmpdir(), "gocab-dev.db");
      if (!fs.existsSync(tmpDbPath) && fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, tmpDbPath);
      }
      if (fs.existsSync(tmpDbPath)) {
        return `file:${tmpDbPath.replace(/\\/g, "/")}`;
      }
    } catch (err) {
      console.warn("Could not copy dev.db to os.tmpdir(), using source directly:", err);
    }
  }

  return `file:${srcPath.replace(/\\/g, "/")}`;
}

function getFallbackClient(): PrismaClient {
  if (globalForPrisma.fallbackPrisma) {
    return globalForPrisma.fallbackPrisma;
  }
  const url = getFallbackSqliteUrl();
  const adapter = new PrismaLibSql({ url });
  const client = new PrismaClient({ adapter });
  globalForPrisma.fallbackPrisma = client;
  return client;
}

function isTursoQuotaOrBlockError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("BLOCKED") ||
    msg.includes("SQL read operations are forbidden") ||
    msg.includes("reads are blocked") ||
    msg.includes("upgrade your plan") ||
    msg.includes("SERVER_ERROR") ||
    msg.includes("HTTP status 403") ||
    msg.includes("HTTP status 429")
  );
}

function isTursoCurrentlyBlocked(): boolean {
  return Boolean(
    globalForPrisma.tursoBlockedUntil && Date.now() < globalForPrisma.tursoBlockedUntil
  );
}

function markTursoBlocked(): void {
  // Retry Turso once every 5 minutes in case the plan was upgraded or quota reset
  globalForPrisma.tursoBlockedUntil = Date.now() + 5 * 60 * 1000;
}

function wrapModelDelegate(modelProp: string | symbol): any {
  const primaryDelegate = (getPrimaryClient() as any)[modelProp];
  if (!primaryDelegate || typeof primaryDelegate !== "object") {
    return primaryDelegate;
  }

  return new Proxy(primaryDelegate, {
    get(_target, methodProp) {
      const activeClient = isTursoCurrentlyBlocked() ? getFallbackClient() : getPrimaryClient();
      const activeDelegate = (activeClient as any)[modelProp];
      const val = activeDelegate?.[methodProp];

      if (typeof val !== "function") {
        return val;
      }

      return (...args: any[]) => {
        if (isTursoCurrentlyBlocked()) {
          const fbDelegate = (getFallbackClient() as any)[modelProp];
          return fbDelegate[methodProp](...args);
        }

        try {
          const result = (getPrimaryClient() as any)[modelProp][methodProp](...args);
          if (result && typeof result.then === "function") {
            return result.catch((err: any) => {
              if (isTursoQuotaOrBlockError(err)) {
                markTursoBlocked();
                const fbDelegate = (getFallbackClient() as any)[modelProp];
                return fbDelegate[methodProp](...args);
              }
              throw err;
            });
          }
          return result;
        } catch (err: any) {
          if (isTursoQuotaOrBlockError(err)) {
            markTursoBlocked();
            const fbDelegate = (getFallbackClient() as any)[modelProp];
            return fbDelegate[methodProp](...args);
          }
          throw err;
        }
      };
    },
  });
}

function createFailoverPrismaClient(): PrismaClient {
  const primary = getPrimaryClient();

  return new Proxy(primary, {
    get(_target, prop) {
      if (prop === "$transaction") {
        return async (arg: any, options?: any) => {
          if (isTursoCurrentlyBlocked()) {
            const fb = getFallbackClient();
            if (typeof arg === "function") {
              return fb.$transaction(arg, options);
            }
            return fb.$transaction(arg, options);
          }
          try {
            return await getPrimaryClient().$transaction(arg, options);
          } catch (err: any) {
            if (isTursoQuotaOrBlockError(err)) {
              markTursoBlocked();
              return getFallbackClient().$transaction(arg, options);
            }
            throw err;
          }
        };
      }

      if (
        prop === "$queryRaw" ||
        prop === "$executeRaw" ||
        prop === "$queryRawUnsafe" ||
        prop === "$executeRawUnsafe"
      ) {
        return async (...args: any[]) => {
          if (isTursoCurrentlyBlocked()) {
            return (getFallbackClient() as any)[prop](...args);
          }
          try {
            return await (getPrimaryClient() as any)[prop](...args);
          } catch (err: any) {
            if (isTursoQuotaOrBlockError(err)) {
              markTursoBlocked();
              return (getFallbackClient() as any)[prop](...args);
            }
            throw err;
          }
        };
      }

      const activeClient = isTursoCurrentlyBlocked() ? getFallbackClient() : getPrimaryClient();
      const val = (activeClient as any)[prop];
      if (val && typeof val === "object" && ! Symbol.iterator.toString().includes(String(prop))) {
        return wrapModelDelegate(prop);
      }
      if (typeof val === "function") {
        return val.bind(activeClient);
      }
      return val;
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createFailoverPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
