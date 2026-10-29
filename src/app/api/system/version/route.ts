import { NextResponse } from "next/server";
import { getServerVersion } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/version
 * Returns the current application deployment ID / commit hash and timestamp.
 * Used by all open client sessions to detect new deployments and refresh automatically.
 */
export async function GET() {
  const version = getServerVersion();
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || "unknown";

  const dbUrl = process.env.DATABASE_URL || "";
  const tursoUrl = process.env.TURSO_DATABASE_URL || "";
  const pgUrl = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";

  const storageDiagnostics = {
    hasPostgres: Boolean(pgUrl),
    postgresProtocol: pgUrl ? pgUrl.split("://")[0] : null,
    hasDatabaseUrl: Boolean(dbUrl),
    databaseUrlProtocol: dbUrl ? dbUrl.split("://")[0] : null,
    hasTursoDatabaseUrl: Boolean(tursoUrl),
    hasKv: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    hasBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    envVarNames: Object.keys(process.env).filter(
      (k) =>
        k.startsWith("VERCEL") ||
        k.startsWith("DATABASE") ||
        k.startsWith("POSTGRES") ||
        k.startsWith("TURSO") ||
        k.startsWith("KV") ||
        k.startsWith("BLOB")
    ),
  };

  return NextResponse.json(
    {
      version,
      buildTime,
      serverTime: Date.now(),
      storageDiagnostics,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
