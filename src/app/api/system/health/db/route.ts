import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const testKey = `_health_check_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const testVal = `ok_${Date.now()}`;

  try {
    const isRemote = Boolean(
      process.env.TURSO_DATABASE_URL ||
      (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:"))
    );

    // 1. Verify read capability and count records
    const [leadsCount, driversCount, vehiclesCount] = await Promise.all([
      prisma.lead.count(),
      prisma.driverProfile.count(),
      prisma.vehicle.count(),
    ]);

    // 2. Verify transactional write, commit, read & cleanup
    let writeConfirmed = false;
    await prisma.$transaction(async (tx) => {
      await tx.setting.create({
        data: {
          key: testKey,
          value: testVal,
        },
      });

      const readBack = await tx.setting.findUnique({
        where: { key: testKey },
      });

      if (readBack?.value === testVal) {
        writeConfirmed = true;
      }

      // Clean up test key
      await tx.setting.delete({
        where: { key: testKey },
      });
    });

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      database: {
        mode: isRemote ? "hosted_database" : "local_sqlite",
        provider: "libsql",
        latencyMs,
        writeTransactionVerified: writeConfirmed,
        counts: {
          leads: leadsCount,
          drivers: driversCount,
          vehicles: vehiclesCount,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[HealthCheck /api/system/health/db] Failed:", err);

    // Clean up if dangling
    try {
      await prisma.setting.delete({ where: { key: testKey } });
    } catch {}

    return NextResponse.json(
      {
        status: "unhealthy",
        error: err?.message || String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
