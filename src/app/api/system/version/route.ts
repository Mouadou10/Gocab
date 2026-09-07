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

  return NextResponse.json(
    {
      version,
      buildTime,
      serverTime: Date.now(),
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
