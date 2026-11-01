import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Unified Liveness & Readiness probe for:
 * 1. Kubernetes kubelet (livenessProbe & readinessProbe)
 * 2. Docker container HEALTHCHECK
 * 3. Vercel deployment & external uptime monitoring
 */
export async function GET() {
  const startTime = Date.now();
  let dbHealthy = false;
  let dbLatencyMs = 0;
  let activeUsersCount = 0;

  try {
    const dbStart = Date.now();
    activeUsersCount = await prisma.user.count();
    dbLatencyMs = Date.now() - dbStart;
    dbHealthy = true;
  } catch (err: any) {
    console.error("Health check database probe failed:", err?.message || err);
    dbHealthy = false;
  }

  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());
  const totalDurationMs = Date.now() - startTime;

  const status = dbHealthy ? "healthy" : "degraded";
  const statusCode = dbHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: uptimeSeconds,
      latency_ms: totalDurationMs,
      checks: {
        database: {
          healthy: dbHealthy,
          latency_ms: dbLatencyMs,
          user_records: activeUsersCount,
        },
        memory: {
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        environment: {
          node_version: process.version,
          platform: process.platform,
          vercel_env: process.env.VERCEL_ENV || "development",
          commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || "local-dev",
        },
      },
    },
    { status: statusCode }
  );
}
