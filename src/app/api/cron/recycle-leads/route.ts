/**
 * Vercel Cron Job — Automated Lead Recycling
 * GET /api/cron/recycle-leads
 *
 * Runs periodically to automatically return eligible leads back to NEW_LEADS:
 * - "No response 1" / "No response 2" after 24 hours.
 * - "To Recall" on the day of the scheduled call.
 */

import { NextRequest, NextResponse } from "next/server";
import { autoRecycleDueLeads } from "@/lib/services/leadRecyclingService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Optional authorization verification if CRON_SECRET is configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In production, Vercel cron requests include the Authorization header
      console.warn("[Cron] Unauthenticated cron request received");
    }

    const result = await autoRecycleDueLeads(true);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("Error in /api/cron/recycle-leads:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal Cron Error" },
      { status: 500 }
    );
  }
}
