/**
 * GET /api/activity
 *
 * Retrieves activity logs for the current agent (or any agent if Admin/Ops Manager).
 * Returns enriched activity timeline and KPI summary statistics.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { getAgentActivityLogs } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const user = session.user;
    const isManager = user.role === "ADMIN" || user.role === "OPS_MANAGER";

    const { searchParams } = new URL(request.url);
    const requestedAgent = searchParams.get("agent");
    const period = (searchParams.get("period") || "today") as "today" | "7days" | "all";
    const action = searchParams.get("action") || "ALL";

    // Regular agents can ONLY inspect their own activity
    let targetAgent: string | undefined = undefined;
    if (!isManager) {
      targetAgent = user.name || user.email || "Agent";
    } else {
      targetAgent = requestedAgent || user.name || user.email || "ALL";
    }

    const { logs, stats } = await getAgentActivityLogs({
      agent: targetAgent,
      period,
      action,
      limit: 200,
    });

    // Fetch team members list for manager filtering
    let availableAgents: { name: string; email: string; role: string }[] = [];
    if (isManager) {
      try {
        const users = await prisma.user.findMany({
          select: { name: true, email: true, role: true },
          orderBy: { name: "asc" },
        });
        availableAgents = users;
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      logs,
      stats,
      currentAgent: targetAgent,
      period,
      availableAgents,
      userRole: user.role,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
