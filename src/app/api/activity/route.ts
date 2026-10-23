/**
 * GET /api/activity
 *
 * Retrieves activity logs for the current agent ("MY"), all agents ("ALL"),
 * or a specific agent.
 * Returns enriched activity timeline, per-agent summaries, and KPI summary statistics.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import {
  getAgentActivityLogs,
  normalizeAgentName,
  matchesAgentIdentity,
  AgentActivitySummary,
} from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const user = session.user;

    const myCanonicalName = normalizeAgentName(user.name || user.email || "Agent");
    const myEmail = (user.email || "").trim();

    const { searchParams } = new URL(request.url);
    const requestedAgentRaw = searchParams.get("agent");
    const period = (searchParams.get("period") || "today") as
      | "today"
      | "yesterday"
      | "7days"
      | "30days"
      | "all";
    const action = searchParams.get("action") || "ALL";
    const search = searchParams.get("search") || "";

    // Default behavior:
    // If no agent param is provided, default to "MY" for individual agents or "ALL" if explicitly requested
    const effectiveAgentParam = requestedAgentRaw || "MY";

    let targetAgentAliases: string[] | undefined = undefined;
    let targetAgentDisplay = "ALL";

    if (effectiveAgentParam === "ALL") {
      targetAgentDisplay = "ALL";
      targetAgentAliases = undefined;
    } else if (
      effectiveAgentParam === "MY" ||
      matchesAgentIdentity(effectiveAgentParam, myCanonicalName, [
        user.name || "",
        myEmail,
      ])
    ) {
      targetAgentDisplay = myCanonicalName;
      const aliases = new Set<string>([myCanonicalName]);
      if (user.name) {
        aliases.add(user.name);
        aliases.add(user.name.toLowerCase());
      }
      if (myEmail) {
        aliases.add(myEmail);
        aliases.add(myEmail.toLowerCase());
      }
      // Also lookup user record in DB for any alternate name/email
      try {
        const dbMe = await prisma.user.findFirst({
          where: {
            OR: [
              ...(myEmail ? [{ email: myEmail }] : []),
              ...(user.name ? [{ name: user.name }] : []),
            ],
          },
          select: { name: true, email: true },
        });
        if (dbMe?.name) {
          aliases.add(dbMe.name);
          aliases.add(normalizeAgentName(dbMe.name));
        }
        if (dbMe?.email) {
          aliases.add(dbMe.email);
        }
      } catch (_) {}

      targetAgentAliases = Array.from(aliases);
    } else {
      const requestedCanonical = normalizeAgentName(effectiveAgentParam);
      targetAgentDisplay = requestedCanonical;
      const aliases = new Set<string>([
        effectiveAgentParam,
        effectiveAgentParam.toLowerCase(),
        requestedCanonical,
        requestedCanonical.toLowerCase(),
      ]);

      try {
        const matchedUser = await prisma.user.findFirst({
          where: {
            OR: [
              { name: { equals: effectiveAgentParam } },
              { name: { equals: requestedCanonical } },
              { email: { equals: effectiveAgentParam } },
            ],
          },
          select: { name: true, email: true },
        });
        if (matchedUser?.name) {
          aliases.add(matchedUser.name);
          aliases.add(normalizeAgentName(matchedUser.name));
        }
        if (matchedUser?.email) {
          aliases.add(matchedUser.email);
        }
      } catch (_) {}

      targetAgentAliases = Array.from(aliases);
    }

    const { logs, stats, agentSummaries } = await getAgentActivityLogs({
      agentAliases: targetAgentAliases,
      period,
      action,
      search,
      limit: 400,
    });

    // Build complete list of available agents and merge with period agentSummaries
    let availableAgents: {
      name: string;
      email: string;
      role: string;
      isMe?: boolean;
    }[] = [];

    const summaryMap = new Map<string, AgentActivitySummary>();
    for (const s of agentSummaries) {
      summaryMap.set(s.name, s);
    }

    try {
      const users = await prisma.user.findMany({
        select: { name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });

      const seenCanonical = new Set<string>();
      for (const u of users) {
        const canonical = normalizeAgentName(u.name || u.email);
        if (seenCanonical.has(canonical)) continue;
        seenCanonical.add(canonical);

        const isMe = matchesAgentIdentity(canonical, myCanonicalName, [
          user.name || "",
          myEmail,
        ]);

        availableAgents.push({
          name: canonical,
          email: u.email,
          role: u.role,
          isMe,
        });
      }

      // Ensure all agents from period summaries are also in availableAgents
      for (const s of agentSummaries) {
        if (!seenCanonical.has(s.name)) {
          seenCanonical.add(s.name);
          availableAgents.push({
            name: s.name,
            email: `${s.name.toLowerCase().replace(/\s+/g, ".")}@gocab.ma`,
            role: "AGENT",
            isMe: matchesAgentIdentity(s.name, myCanonicalName, [
              user.name || "",
              myEmail,
            ]),
          });
        }
      }

      // Ensure core Lead/Onboarding agents always appear in agentSummaries (even if 0 actions today)
      const coreLeadRoles = new Set([
        "LEAD_ACQUISITION_JR",
        "BRAND_MANAGER",
        "ONBOARDING_SPECIALIST",
      ]);
      for (const ag of availableAgents) {
        if (
          !summaryMap.has(ag.name) &&
          (ag.isMe || coreLeadRoles.has(ag.role))
        ) {
          const emptySummary: AgentActivitySummary = {
            name: ag.name,
            totalActions: 0,
            leadsHandled: 0,
            calls: 0,
            trainingsFixed: 0,
            statusChanges: 0,
            recalls: 0,
            presences: 0,
            whatsapp: 0,
            notes: 0,
            lastActiveAt: null,
          };
          summaryMap.set(ag.name, emptySummary);
        }
      }
    } catch (_) {}

    const enrichedSummaries = Array.from(summaryMap.values()).sort((a, b) => {
      const aIsMe = matchesAgentIdentity(a.name, myCanonicalName, [
        user.name || "",
        myEmail,
      ]);
      const bIsMe = matchesAgentIdentity(b.name, myCanonicalName, [
        user.name || "",
        myEmail,
      ]);
      if (aIsMe && !bIsMe) return -1;
      if (!aIsMe && bIsMe) return 1;
      if (b.totalActions !== a.totalActions) return b.totalActions - a.totalActions;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      logs: logs.map((l: any) => ({
        ...l,
        agent: normalizeAgentName(l.agent),
      })),
      stats,
      agentSummaries: enrichedSummaries,
      currentAgent: targetAgentDisplay,
      myCanonicalName,
      period,
      availableAgents,
      userRole: user.role,
      userName: myCanonicalName,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
