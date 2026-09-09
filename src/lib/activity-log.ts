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
