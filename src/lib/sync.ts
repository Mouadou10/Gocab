/**
 * Server-Side Sync Manager
 *
 * Tracks the latest mutation timestamps for entities (leads, tickets, settings)
 * and deployment version across serverless instances using Turso DB + memory cache.
 */

import { prisma } from "@/lib/prisma";

export interface SyncState {
  leads: number;
  tickets: number;
  settings: number;
  collections: number;
  version: string;
  updatedAt: number;
}

const SERVER_START_TIME = Date.now();
const SERVER_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.NEXT_PUBLIC_APP_VERSION ||
  SERVER_START_TIME.toString();

const globalForSync = globalThis as unknown as {
  syncCache?: SyncState;
};

const SYNC_SETTING_KEY = "data_sync_state";

/**
 * Retrieves the current synchronization timestamps for all monitored entities.
 */
export async function getSyncState(): Promise<SyncState> {
  const fallback: SyncState = globalForSync.syncCache || {
    leads: SERVER_START_TIME,
    tickets: SERVER_START_TIME,
    settings: SERVER_START_TIME,
    collections: SERVER_START_TIME,
    version: SERVER_VERSION,
    updatedAt: SERVER_START_TIME,
  };

  try {
    const record = await prisma.setting.findUnique({
      where: { key: SYNC_SETTING_KEY },
    });

    if (record?.value) {
      const parsed = JSON.parse(record.value);
      const state: SyncState = {
        leads: Number(parsed.leads) || fallback.leads,
        tickets: Number(parsed.tickets) || fallback.tickets,
        settings: Number(parsed.settings) || fallback.settings,
        collections: Number(parsed.collections) || fallback.collections,
        version: SERVER_VERSION, // Always report current server version
        updatedAt: Number(parsed.updatedAt) || Date.now(),
      };
      globalForSync.syncCache = state;
      return state;
    }
  } catch (err) {
    console.warn("getSyncState Turso read fallback:", err);
  }

  return fallback;
}

/**
 * Touches the sync state for one or more entities, updating both memory and DB.
 */
export async function touchSyncState(
  entity: "leads" | "tickets" | "settings" | "collections" | "all"
): Promise<SyncState> {
  const now = Date.now();
  const current = await getSyncState();

  const nextState: SyncState = {
    ...current,
    leads: entity === "leads" || entity === "all" ? now : current.leads,
    tickets: entity === "tickets" || entity === "all" ? now : current.tickets,
    settings: entity === "settings" || entity === "all" ? now : current.settings,
    collections: entity === "collections" || entity === "all" ? now : current.collections,
    version: SERVER_VERSION,
    updatedAt: now,
  };

  globalForSync.syncCache = nextState;

  // Persist asynchronously in background so callers are not slowed down
  prisma.setting
    .upsert({
      where: { key: SYNC_SETTING_KEY },
      update: { value: JSON.stringify(nextState) },
      create: { key: SYNC_SETTING_KEY, value: JSON.stringify(nextState) },
    })
    .catch((err) => {
      console.warn("touchSyncState Turso upsert warning:", err?.message || err);
    });

  return nextState;
}

export function getServerVersion(): string {
  return SERVER_VERSION;
}
