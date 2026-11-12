/**
 * Lead Recycling Service
 *
 * Implements automated pipeline recycling rules:
 * 1. "No response 1" & "No response 2" automatically return to NEW_LEADS after 24 hours.
 * 2. "To Recall" automatically returns to NEW_LEADS on the day set for the call (or when scheduled time arrives).
 */

import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { invalidateLeadsCache } from "@/lib/leads-cache";

let lastRecycleTimestamp = 0;
const RECYCLE_THROTTLE_MS = 25000; // Throttle execution to at most once per 25 seconds

export interface RecycleResult {
  recycledNoResponse: number;
  recycledToRecall: number;
  totalRecycled: number;
  recycledLeadIds: string[];
}

/**
 * Checks for leads eligible for automated return to NEW_LEADS and executes the batch update.
 */
export async function autoRecycleDueLeads(force = false): Promise<RecycleResult> {
  const now = new Date();
  const nowMs = now.getTime();

  if (!force && nowMs - lastRecycleTimestamp < RECYCLE_THROTTLE_MS) {
    return {
      recycledNoResponse: 0,
      recycledToRecall: 0,
      totalRecycled: 0,
      recycledLeadIds: [],
    };
  }

  lastRecycleTimestamp = nowMs;

  const cutoff24h = new Date(nowMs - 24 * 60 * 60 * 1000);
  // Moroccan timezone (Africa/Casablanca) today date string: YYYY-MM-DD
  const todayCasablancaStr = now.toLocaleDateString("en-CA", {
    timeZone: "Africa/Casablanca",
  });

  // Query candidate leads in either No response 1/2 or To Recall
  const candidateLeads = await prisma.lead.findMany({
    where: {
      OR: [
        {
          brand_status: {
            in: [
              "No response 1",
              "No response 2",
              "NO RESPONSE 1",
              "NO RESPONSE 2",
              "no response 1",
              "no response 2",
            ],
          },
        },
        {
          brand_status: {
            in: ["To Recall", "TO RECALL", "to recall"],
          },
        },
      ],
    },
    select: {
      id: true,
      raw_name: true,
      brand_status: true,
      reminder_date: true,
      status_changed_at: true,
      updated_at: true,
    },
  });

  if (candidateLeads.length === 0) {
    return {
      recycledNoResponse: 0,
      recycledToRecall: 0,
      totalRecycled: 0,
      recycledLeadIds: [],
    };
  }

  const eligibleNoResponse: typeof candidateLeads = [];
  const eligibleToRecall: typeof candidateLeads = [];

  for (const l of candidateLeads) {
    const status = (l.brand_status || "").trim().toLowerCase();
    const referenceTime = l.status_changed_at || l.updated_at || new Date(0);

    if (status === "no response 1" || status === "no response 2") {
      // Must be at least 24 hours old since status change
      if (referenceTime.getTime() <= cutoff24h.getTime()) {
        eligibleNoResponse.push(l);
      }
    } else if (status === "to recall") {
      // Must return on the day set for the call (or when reminder_date <= now)
      if (!l.reminder_date) {
        // If agent didn't set a reminder date, fallback to 24h
        if (referenceTime.getTime() <= cutoff24h.getTime()) {
          eligibleToRecall.push(l);
        }
      } else {
        const rem = new Date(l.reminder_date);
        if (isNaN(rem.getTime())) {
          eligibleToRecall.push(l);
        } else {
          const reminderDayCasablanca = rem.toLocaleDateString("en-CA", {
            timeZone: "Africa/Casablanca",
          });
          // Due if the exact timestamp has passed OR if the calendar day has arrived (reminderDay <= today)
          if (rem.getTime() <= nowMs || reminderDayCasablanca <= todayCasablancaStr) {
            eligibleToRecall.push(l);
          }
        }
      }
    }
  }

  const totalEligible = eligibleNoResponse.length + eligibleToRecall.length;
  if (totalEligible === 0) {
    return {
      recycledNoResponse: 0,
      recycledToRecall: 0,
      totalRecycled: 0,
      recycledLeadIds: [],
    };
  }

  const allEligible = [...eligibleNoResponse, ...eligibleToRecall];
  const eligibleIds = allEligible.map((l) => l.id);

  // Execute atomic update in database
  await prisma.lead.updateMany({
    where: {
      id: { in: eligibleIds },
    },
    data: {
      board_column: "NEW_LEADS",
      brand_status: null,
      training_status: null,
      reminder_date: null,
      status_changed_at: null,
      updated_at: now,
    },
  });

  // Create audit activity log entries
  const logEntries: Array<{
    lead_id: string;
    agent: string;
    action: string;
    detail: string;
    created_at: Date;
  }> = [];

  for (const l of eligibleNoResponse) {
    logEntries.push({
      lead_id: l.id,
      agent: "Système Auto",
      action: "AUTO_RECYCLE",
      detail: `Retour automatique dans New Leads après 24h sans réponse (${l.brand_status})`,
      created_at: now,
    });
  }

  for (const l of eligibleToRecall) {
    const formattedDate = l.reminder_date
      ? new Date(l.reminder_date).toLocaleDateString("fr-FR")
      : "non définie";
    logEntries.push({
      lead_id: l.id,
      agent: "Système Auto",
      action: "AUTO_RECYCLE",
      detail: `Retour automatique dans New Leads le jour du rappel programmé (${formattedDate})`,
      created_at: now,
    });
  }

  if (logEntries.length > 0) {
    await prisma.leadActivityLog.createMany({
      data: logEntries,
    }).catch(() => {});
  }

  // Invalidate memory cache and broadcast LiveSync mutation to all open tabs
  invalidateLeadsCache();
  await touchSyncState("leads").catch(() => {});

  return {
    recycledNoResponse: eligibleNoResponse.length,
    recycledToRecall: eligibleToRecall.length,
    totalRecycled: totalEligible,
    recycledLeadIds: eligibleIds,
  };
}
