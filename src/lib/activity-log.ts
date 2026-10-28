import { prisma } from "@/lib/prisma";

let tableEnsured = true;

/**
 * Canonical agent name resolver.
 * Unifies casing, first-name shorthand, and email addresses into a single clean display name
 * so an agent's history is never fragmented across multiple spellings.
 */
export function normalizeAgentName(raw?: string | null): string {
  if (!raw) return "Agent";
  const clean = raw.trim();
  if (!clean) return "Agent";

  const lower = clean.toLowerCase();
  if (lower === "agent" || lower === "system" || lower === "système") return "Agent";
  if (lower.includes("bot") && lower.includes("whatsapp")) return "Bot WhatsApp";

  if (lower.includes("nour") || lower.includes("nour.abouri")) return "Nour Abouri";
  if (lower.includes("kaoutar") || lower.includes("kaoutar.ouardi")) return "Kaoutar Ouardi";
  if (lower.includes("ayoub.gsaib") || lower.includes("ayoub gsaib") || lower === "ayoub") return "Ayoub Gsaib";
  if (lower.includes("ayoub.rassid") || lower.includes("ayoub rassid")) return "Ayoub Rassid";
  if (lower.includes("hamza") || lower.includes("hamza.rassid")) return "Hamza Rassid";
  if (lower.includes("salma") || lower.includes("salma.abouri")) return "Salma Abouri";
  if (lower.includes("aziz") || lower.includes("mohamed.aziz")) return "Mohamed Aziz";
  if (lower.includes("mehdi") || lower.includes("mehdi.elyattouti")) return "Mehdi Elyattouti";
  if (lower.includes("mouad") || lower.includes("mouad.koudia")) return "Mouad Koudia";
  if (lower.includes("kurban") || lower.includes("kurbankerimov")) return "Kurban";
  if (lower.includes("ida") || lower.includes("pauleida")) return "Ida Paul";
  if (lower.includes("wilfried") || lower.includes("wil fried")) return "Wilfried Koua";
  if (lower.includes("nehemie")) return "Nehemie Koffi";
  if (lower.includes("landry")) return "Landry Kolai";

  // If it's an email address, format prefix nicely
  if (clean.includes("@")) {
    const prefix = clean.split("@")[0].replace(/[._-]+/g, " ");
    return prefix
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return clean
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Checks whether a log's agent field belongs to the requested agent (supporting aliases, emails, and partial names).
 */
export function matchesAgentIdentity(logAgent: string | null | undefined, targetAgent: string, extraAliases: string[] = []): boolean {
  if (!targetAgent || targetAgent === "ALL") return true;
  const normLog = normalizeAgentName(logAgent).toLowerCase();
  const normTarget = normalizeAgentName(targetAgent).toLowerCase();
  if (normLog === normTarget) return true;

  const rawLogLower = (logAgent || "").trim().toLowerCase();
  for (const alias of [targetAgent, ...extraAliases]) {
    if (!alias) continue;
    const aLower = alias.trim().toLowerCase();
    if (!aLower) continue;
    if (rawLogLower === aLower || normLog === normalizeAgentName(alias).toLowerCase()) {
      return true;
    }
    // Match first name token if >= 4 chars (e.g. "nour", "kaoutar", "mouad")
    const firstToken = aLower.split(/[\s.@_-]+/)[0];
    if (firstToken && firstToken.length >= 4 && normLog.includes(firstToken)) {
      return true;
    }
  }
  return false;
}

/**
 * Ensures the LeadActivityLog table exists in Turso/LibSQL database.
 * Runs once idempotently to avoid "no such table" runtime errors.
 */
export async function ensureLeadActivityLogTable(force = false): Promise<void> {
  if (tableEnsured && !force) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LeadActivityLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "lead_id" TEXT NOT NULL,
        "agent" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "detail" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LeadActivityLog_lead_id_created_at_idx"
      ON "LeadActivityLog"("lead_id", "created_at")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "LeadActivityLog_agent_idx"
      ON "LeadActivityLog"("agent")
    `);

    tableEnsured = true;
  } catch (err: any) {
    console.error("Auto-creating LeadActivityLog table warning:", err?.message);
  }
}

export interface ActivityLogEntry {
  lead_id: string;
  agent: string;
  action: string;
  detail?: string | null;
}

export async function logLeadActivity(
  leadId: string,
  agent: string,
  action: string,
  detail?: string | null
): Promise<void> {
  const canonicalAgent = normalizeAgentName(agent);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).leadActivityLog.create({
      data: {
        lead_id: leadId,
        agent: canonicalAgent,
        action,
        detail: detail ?? null,
      },
    });
  } catch (err: any) {
    if (String(err?.message || "").includes("no such table")) {
      await ensureLeadActivityLogTable(true);
      await (prisma as any).leadActivityLog.create({
        data: {
          lead_id: leadId,
          agent: canonicalAgent,
          action,
          detail: detail ?? null,
        },
      }).catch(() => {});
    } else {
      console.warn("Failed to log lead activity:", err?.message);
    }
  }
}

export async function logManyLeadActivities(entries: ActivityLogEntry[]): Promise<void> {
  if (!entries || entries.length === 0) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).leadActivityLog.createMany({
      data: entries.map((e) => ({
        lead_id: e.lead_id,
        agent: normalizeAgentName(e.agent),
        action: e.action,
        detail: e.detail ?? null,
      })),
    });
  } catch (err: any) {
    if (String(err?.message || "").includes("no such table")) {
      await ensureLeadActivityLogTable(true);
      await (prisma as any).leadActivityLog.createMany({
        data: entries.map((e) => ({
          lead_id: e.lead_id,
          agent: normalizeAgentName(e.agent),
          action: e.action,
          detail: e.detail ?? null,
        })),
      }).catch(() => {});
    } else {
      console.warn("Failed to log many lead activities:", err?.message);
    }
  }
}

export interface GetAgentActivityOptions {
  agent?: string;
  agentAliases?: string[];
  period?: "today" | "yesterday" | "7days" | "30days" | "all";
  action?: string;
  search?: string;
  limit?: number;
}

export interface AgentActivitySummary {
  name: string;
  totalActions: number;
  leadsHandled: number;
  calls: number;
  trainingsFixed: number;
  statusChanges: number;
  recalls: number;
  presences: number;
  whatsapp: number;
  notes: number;
  lastActiveAt: string | null;
}

export async function getAgentActivityLogs(options: GetAgentActivityOptions = {}) {
  await ensureLeadActivityLogTable();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodWhere: any = {};

  // Period filtering
  const now = new Date();
  if (options.period === "today") {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    periodWhere.created_at = { gte: startOfToday };
  } else if (options.period === "yesterday") {
    const startOfYesterday = new Date(now);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(now);
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);
    periodWhere.created_at = { gte: startOfYesterday, lte: endOfYesterday };
  } else if (options.period === "7days") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    periodWhere.created_at = { gte: sevenDaysAgo };
  } else if (options.period === "30days") {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    periodWhere.created_at = { gte: thirtyDaysAgo };
  }

  // Fetch all logs within the selected period (up to a generous cap) so we can:
  // 1) Accurately compute per-agent summaries across the team
  // 2) Filter by normalized agent identity without SQLite case-sensitivity pitfalls
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPeriodLogs = await (prisma as any).leadActivityLog.findMany({
    where: periodWhere,
    orderBy: { created_at: "desc" },
    take: 2500,
  });

  // Normalize agent names on all fetched logs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedPeriodLogs = rawPeriodLogs.map((l: any) => ({
    ...l,
    agent: normalizeAgentName(l.agent),
  }));

  // Build per-agent activity summary across the period (before agent/action/search filter)
  const summaryByAgent = new Map<
    string,
    {
      name: string;
      totalActions: number;
      leadIds: Set<string>;
      calls: number;
      trainingsFixed: number;
      statusChanges: number;
      recalls: number;
      presences: number;
      whatsapp: number;
      notes: number;
      lastActiveAt: string | null;
    }
  >();

  for (const log of normalizedPeriodLogs) {
    const ag = log.agent || "Agent";
    if (ag === "Bot WhatsApp") continue;
    let entry = summaryByAgent.get(ag);
    if (!entry) {
      entry = {
        name: ag,
        totalActions: 0,
        leadIds: new Set<string>(),
        calls: 0,
        trainingsFixed: 0,
        statusChanges: 0,
        recalls: 0,
        presences: 0,
        whatsapp: 0,
        notes: 0,
        lastActiveAt: log.created_at ? new Date(log.created_at).toISOString() : null,
      };
      summaryByAgent.set(ag, entry);
    }
    entry.totalActions++;
    if (log.lead_id) entry.leadIds.add(log.lead_id);
    if (log.action === "CALL_INITIATED") entry.calls++;
    if (
      log.action === "STATUS_CHANGED" ||
      log.action === "TRAINING_STATUS_CHANGED" ||
      log.action === "COLUMN_MOVED" ||
      log.action === "BATCH_STATUS_UPDATE"
    ) {
      entry.statusChanges++;
      if ((log.detail || "").toLowerCase().includes("training fixed")) {
        entry.trainingsFixed++;
      }
    }
    if (log.action === "RECALL_SET" || log.action === "TRAINING_DATE_SET") entry.recalls++;
    if (log.action === "PRESENCE_CONFIRMED") entry.presences++;
    if (log.action === "WHATSAPP_SENT" || log.action === "WHATSAPP_OPENED") entry.whatsapp++;
    if (log.action === "NOTE_ADDED") entry.notes++;
  }

  const agentSummaries: AgentActivitySummary[] = Array.from(summaryByAgent.values())
    .map((s) => ({
      name: s.name,
      totalActions: s.totalActions,
      leadsHandled: s.leadIds.size,
      calls: s.calls,
      trainingsFixed: s.trainingsFixed,
      statusChanges: s.statusChanges,
      recalls: s.recalls,
      presences: s.presences,
      whatsapp: s.whatsapp,
      notes: s.notes,
      lastActiveAt: s.lastActiveAt,
    }))
    .sort((a, b) => b.leadsHandled - a.leadsHandled || b.totalActions - a.totalActions);

  // Filter by requested agent (using normalized + alias matching)
  const targetAgent = options.agent && options.agent !== "ALL" ? options.agent : null;
  const aliases = options.agentAliases || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentFilteredLogs = normalizedPeriodLogs.filter((l: any) => {
    if (!targetAgent && aliases.length === 0) return true;
    return matchesAgentIdentity(l.agent, targetAgent || aliases[0] || "ALL", aliases);
  });

  // Calculate summary stats for the selected agent (before action Filter chip so all filter chips show their counts)
  const uniqueLeadsForAgent = new Set<string>();
  let trainingsFixedCount = 0;
  for (const l of agentFilteredLogs) {
    if (l.lead_id) uniqueLeadsForAgent.add(l.lead_id);
    if (
      (l.action === "STATUS_CHANGED" || l.action === "BATCH_STATUS_UPDATE") &&
      (l.detail || "").toLowerCase().includes("training fixed")
    ) {
      trainingsFixedCount++;
    }
  }

  const stats = {
    total: agentFilteredLogs.length,
    leadsHandled: uniqueLeadsForAgent.size,
    trainingsFixed: trainingsFixedCount,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statusChanged: agentFilteredLogs.filter((l: any) =>
      l.action === "STATUS_CHANGED" ||
      l.action === "TRAINING_STATUS_CHANGED" ||
      l.action === "COLUMN_MOVED" ||
      l.action === "BATCH_STATUS_UPDATE"
    ).length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recallSet: agentFilteredLogs.filter((l: any) => l.action === "RECALL_SET" || l.action === "TRAINING_DATE_SET").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    whatsappSent: agentFilteredLogs.filter((l: any) => l.action === "WHATSAPP_SENT" || l.action === "WHATSAPP_OPENED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    presenceConfirmed: agentFilteredLogs.filter((l: any) => l.action === "PRESENCE_CONFIRMED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notesAdded: agentFilteredLogs.filter((l: any) => l.action === "NOTE_ADDED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callsInitiated: agentFilteredLogs.filter((l: any) => l.action === "CALL_INITIATED").length,
  };

  // Now apply Action Filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filteredLogs = agentFilteredLogs.filter((l: any) => {
    if (!options.action || options.action === "ALL") return true;
    if (options.action === "WHATSAPP") {
      return l.action === "WHATSAPP_SENT" || l.action === "WHATSAPP_OPENED";
    }
    if (options.action === "STATUS") {
      return (
        l.action === "STATUS_CHANGED" ||
        l.action === "TRAINING_STATUS_CHANGED" ||
        l.action === "COLUMN_MOVED" ||
        l.action === "BATCH_STATUS_UPDATE"
      );
    }
    if (options.action === "TRAINING_FIXED") {
      return (
        (l.action === "STATUS_CHANGED" || l.action === "BATCH_STATUS_UPDATE") &&
        (l.detail || "").toLowerCase().includes("training fixed")
      );
    }
    if (options.action === "RECALL_SET") {
      return l.action === "RECALL_SET" || l.action === "TRAINING_DATE_SET";
    }
    return l.action === options.action;
  });

  // Get lead metadata for all unique lead_ids in filteredLogs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadIds = Array.from(new Set(filteredLogs.map((l: any) => l.lead_id))).filter(Boolean) as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let leadsMap: Record<string, any> = {};
  if (leadIds.length > 0) {
    try {
      const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: {
          id: true,
          raw_name: true,
          sanitized_phone: true,
          board_column: true,
          brand_status: true,
          training_status: true,
          city: true,
          handled_by: true,
          reminder_date: true,
          notes: true,
        },
      });
      leadsMap = Object.fromEntries(leads.map((l) => [l.id, l]));
    } catch (_) {}
  }

  // Enrich logs with lead details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let enrichedLogs = filteredLogs.map((log: any) => ({
    ...log,
    lead: leadsMap[log.lead_id] || null,
  }));

  // Apply full-text search across detail, agent, and lead fields
  if (options.search && options.search.trim().length > 0) {
    const q = options.search.trim().toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enrichedLogs = enrichedLogs.filter((l: any) => {
      const detailMatch = (l.detail || "").toLowerCase().includes(q);
      const agentMatch = (l.agent || "").toLowerCase().includes(q);
      const nameMatch = (l.lead?.raw_name || "").toLowerCase().includes(q);
      const phoneMatch = (l.lead?.sanitized_phone || "").toLowerCase().includes(q);
      const cityMatch = (l.lead?.city || "").toLowerCase().includes(q);
      const statusMatch =
        (l.lead?.brand_status || "").toLowerCase().includes(q) ||
        (l.lead?.training_status || "").toLowerCase().includes(q);
      return detailMatch || agentMatch || nameMatch || phoneMatch || cityMatch || statusMatch;
    });
  }

  // Cap returned logs to limit
  const finalLogs = enrichedLogs.slice(0, options.limit || 400);

  return { logs: finalLogs, stats, agentSummaries };
}
