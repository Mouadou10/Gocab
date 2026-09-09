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
  period?: "today" | "7days" | "all";
  action?: string;
  limit?: number;
}

export async function getAgentActivityLogs(options: GetAgentActivityOptions = {}) {
  await ensureLeadActivityLogTable();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};

  if (options.agent && options.agent !== "ALL") {
    whereClause.agent = options.agent;
  }

  if (options.action && options.action !== "ALL") {
    whereClause.action = options.action;
  }

  if (options.period === "today") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    whereClause.created_at = { gte: startOfToday };
  } else if (options.period === "7days") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    whereClause.created_at = { gte: sevenDaysAgo };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = await (prisma as any).leadActivityLog.findMany({
    where: whereClause,
    orderBy: { created_at: "desc" },
    take: options.limit || 100,
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
  const enrichedLogs = logs.map((log: any) => ({
    ...log,
    lead: leadsMap[log.lead_id] || null,
  }));

  // Calculate summary stats
  const stats = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    total: enrichedLogs.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statusChanged: enrichedLogs.filter((l: any) => l.action === "STATUS_CHANGED" || l.action === "TRAINING_STATUS_CHANGED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recallSet: enrichedLogs.filter((l: any) => l.action === "RECALL_SET").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    whatsappSent: enrichedLogs.filter((l: any) => l.action === "WHATSAPP_SENT" || l.action === "WHATSAPP_OPENED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    presenceConfirmed: enrichedLogs.filter((l: any) => l.action === "PRESENCE_CONFIRMED").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notesAdded: enrichedLogs.filter((l: any) => l.action === "NOTE_ADDED").length,
  };

  return { logs: enrichedLogs, stats };
}

