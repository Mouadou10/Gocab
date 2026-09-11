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
    const period = (searchParams.get("period") || "today") as
      | "today"
      | "yesterday"
      | "7days"
      | "30days"
      | "all";
    const action = searchParams.get("action") || "ALL";
    const search = searchParams.get("search") || "";

    // Build agent aliases for target agent to ensure zero missed records
    let targetAgentAliases: string[] | undefined = undefined;
    let targetAgentDisplay = "ALL";

    if (!isManager) {
      // Regular agents inspect ONLY their own activity
      const myName = user.name || "";
      const myEmail = user.email || "";
      targetAgentDisplay = myName || myEmail || "Mon Journal";
      
      const aliases = new Set<string>();
      if (myName) {
        aliases.add(myName);
        aliases.add(myName.toLowerCase());
      }
      if (myEmail) {
        aliases.add(myEmail);
        aliases.add(myEmail.toLowerCase());
      }
      targetAgentAliases = Array.from(aliases);
    } else {
      // Managers can choose ALL or a specific agent
      if (!requestedAgent || requestedAgent === "ALL") {
        targetAgentDisplay = "ALL";
        targetAgentAliases = undefined; // Query all
      } else {
        targetAgentDisplay = requestedAgent;
        const aliases = new Set<string>();
        aliases.add(requestedAgent);
        aliases.add(requestedAgent.toLowerCase());

        // Find user by name or email to add their email/name pair
        try {
          const matchedUser = await prisma.user.findFirst({
            where: {
              OR: [
                { name: { equals: requestedAgent } },
                { email: { equals: requestedAgent } },
              ],
            },
            select: { name: true, email: true },
          });
          if (matchedUser?.name) {
            aliases.add(matchedUser.name);
            aliases.add(matchedUser.name.toLowerCase());
          }
          if (matchedUser?.email) {
            aliases.add(matchedUser.email);
            aliases.add(matchedUser.email.toLowerCase());
          }
        } catch (_) {}

        targetAgentAliases = Array.from(aliases);
      }
    }

    const { logs, stats } = await getAgentActivityLogs({
      agentAliases: targetAgentAliases,
      period,
      action,
      search,
      limit: 300,
    });

    // Fetch team members list for manager filtering with their active counts
    let availableAgents: { name: string; email: string; role: string; count?: number }[] = [];
    if (isManager) {
      try {
        const users = await prisma.user.findMany({
          select: { name: true, email: true, role: true },
          orderBy: { name: "asc" },
        });

        // Also fetch distinct agents from the log table to include any historical agents
        const loggedAgents = await prisma.leadActivityLog.findMany({
          select: { agent: true },
          distinct: ["agent"],
        });

        const agentNameSet = new Set(users.map((u) => u.name));
        for (const la of loggedAgents) {
          if (la.agent && !agentNameSet.has(la.agent)) {
            users.push({
              name: la.agent,
              email: `${la.agent.toLowerCase().replace(/\s+/g, ".")}@gocab.io`,
              role: "AGENT",
            });
            agentNameSet.add(la.agent);
          }
        }

        availableAgents = users;
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      logs,
      stats,
      currentAgent: targetAgentDisplay,
      period,
      availableAgents,
      userRole: user.role,
      userName: user.name || "Agent",
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
