import { prisma } from "@/lib/prisma";

let tableEnsured = false;

/**
 * Ensures the LeadActivityLog table exists in Turso/LibSQL database.
 * Runs once idempotently to avoid "no such table" runtime errors.
 */
export async function ensureLeadActivityLogTable(): Promise<void> {
  if (tableEnsured) return;
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
  try {
    await ensureLeadActivityLogTable();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).leadActivityLog.create({
      data: {
        lead_id: leadId,
        agent,
        action,
        detail: detail ?? null,
      },
    });
  } catch (err: any) {
    console.warn("Failed to log lead activity:", err?.message);
  }
}

export async function logManyLeadActivities(entries: ActivityLogEntry[]): Promise<void> {
  if (!entries || entries.length === 0) return;
  try {
    await ensureLeadActivityLogTable();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).leadActivityLog.createMany({
      data: entries.map((e) => ({
        lead_id: e.lead_id,
        agent: e.agent,
        action: e.action,
        detail: e.detail ?? null,
      })),
    });
  } catch (err: any) {
    console.warn("Failed to log many lead activities:", err?.message);
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

export async function getAgentActivityLogs(options: GetAgentActivityOptions = {}) {
  await ensureLeadActivityLogTable();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};

  // Resolve agent filter (support multi-alias such as [name, email, lowercase name])
  if (options.agentAliases && options.agentAliases.length > 0) {
    whereClause.agent = { in: options.agentAliases };
  } else if (options.agent && options.agent !== "ALL") {
    whereClause.agent = options.agent;
  }

  if (options.action && options.action !== "ALL") {
    if (options.action === "WHATSAPP") {
      whereClause.action = { in: ["WHATSAPP_SENT", "WHATSAPP_OPENED"] };
    } else if (options.action === "STATUS") {
      whereClause.action = { in: ["STATUS_CHANGED", "TRAINING_STATUS_CHANGED", "COLUMN_MOVED"] };
    } else {
      whereClause.action = options.action;
    }
  }

  // Period filtering
  const now = new Date();
  if (options.period === "today") {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    whereClause.created_at = { gte: startOfToday };
  } else if (options.period === "yesterday") {
    const startOfYesterday = new Date(now);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(now);
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);
    whereClause.created_at = { gte: startOfYesterday, lte: endOfYesterday };
  } else if (options.period === "7days") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    whereClause.created_at = { gte: sevenDaysAgo };
  } else if (options.period === "30days") {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    whereClause.created_at = { gte: thirtyDaysAgo };
  }

  // Full-text search filtering across actions, details, agents, and candidate metadata
  if (options.search && options.search.trim().length > 0) {
    const query = options.search.trim();
    // Pre-query matching leads by name, phone, or city
    let matchedLeadIds: string[] = [];
    try {
      const matchingLeads = await prisma.lead.findMany({
        where: {
          OR: [
            { raw_name: { contains: query } },
            { sanitized_phone: { contains: query } },
            { city: { contains: query } },
          ],
        },
        select: { id: true },
        take: 100,
      });
      matchedLeadIds = matchingLeads.map((l) => l.id);
    } catch (_) {}

    whereClause.OR = [
      { detail: { contains: query } },
      { agent: { contains: query } },
      ...(matchedLeadIds.length > 0 ? [{ lead_id: { in: matchedLeadIds } }] : []),
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = await (prisma as any).leadActivityLog.findMany({
    where: whereClause,
    orderBy: { created_at: "desc" },
    take: options.limit || 300,
  });

  // Get lead metadata for all unique lead_ids in logs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadIds = Array.from(new Set(logs.map((l: any) => l.lead_id))).filter(Boolean) as string[];
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
        },
      });
      leadsMap = Object.fromEntries(leads.map((l) => [l.id, l]));
    } catch (_) {}
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let enrichedLogs = logs.map((log: any) => ({
    ...log,
    lead: leadsMap[log.lead_id] || null,
  }));

  // Calculate summary stats
  const stats = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    total: enrichedLogs.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statusChanged: enrichedLogs.filter((l: any) => l.action === "STATUS_CHANGED" || l.action === "TRAINING_STATUS_CHANGED" || l.action === "COLUMN_MOVED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recallSet: enrichedLogs.filter((l: any) => l.action === "RECALL_SET").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    whatsappSent: enrichedLogs.filter((l: any) => l.action === "WHATSAPP_SENT" || l.action === "WHATSAPP_OPENED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    presenceConfirmed: enrichedLogs.filter((l: any) => l.action === "PRESENCE_CONFIRMED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notesAdded: enrichedLogs.filter((l: any) => l.action === "NOTE_ADDED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callsInitiated: enrichedLogs.filter((l: any) => l.action === "CALL_INITIATED").length,
  };

  return { logs: enrichedLogs, stats };
}

