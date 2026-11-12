/**
 * Automated Lead Recycling API Endpoint
 * POST /api/leads/recycle-auto
 * GET /api/leads/recycle-auto
 *
 * Automatically recycles:
 * - "No response 1" and "No response 2" after 24 hours.
 * - "To Recall" on the day set for the call.
 */

import { NextRequest, NextResponse } from "next/server";
import { autoRecycleDueLeads } from "@/lib/services/leadRecyclingService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get("force") === "true";
    const result = await autoRecycleDueLeads(force);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Error in /api/leads/recycle-auto (POST):", error);
    return NextResponse.json(
      { error: "Échec du recyclage automatique des leads", message: error?.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get("force") === "true";
    const result = await autoRecycleDueLeads(force);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Error in /api/leads/recycle-auto (GET):", error);
    return NextResponse.json(
      { error: "Échec du recyclage automatique des leads", message: error?.message },
      { status: 500 }
    );
  }
}
