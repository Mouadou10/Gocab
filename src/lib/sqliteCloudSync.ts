/**
 * Cross-Container SQLite Cloud Sync
 *
 * 1. Google Drive Real-Time Operation WAL (`_gocab_realtime_wal.json`):
 *    When Turso Cloud hits monthly row-read limits on Vercel Serverless, each Lambda container
 *    boots from the identical bundled `dev.db` copied to `/tmp/gocab-dev.db`.
 *    Because `/tmp` is isolated per Lambda instance (and per route handler such as
 *    `/api/accidents` vs `/api/accidents/[id]` or `/api/leads` vs `/api/leads/[id]`),
 *    this module records deterministic Prisma write operations into a compact JSON
 *    Write-Ahead Log on Google Drive (via cached Service Account OAuth2 token) and
 *    replays unseen entries onto every container before reads/writes (~45-90ms).
 *
 * 2. Optional Postgres Bytea Snapshot Replica:
 *    If `POSTGRES_URL` / `POSTGRES_PRISMA_URL` is configured, supports full compressed
 *    SQLite snapshot replication.
 */

import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { after } from "next/server";
import { Pool } from "pg";

export interface WalEntry {
  id: string;
  seq: number;
  ts: number;
  model: string;
  method: string;
  args: any[];
}

interface WalDocument {
  version: number;
  updatedAt: string;
  entries: WalEntry[];
}

interface SyncGlobalState {
  // Postgres replica state (optional)
  pgPool?: Pool | null;
  pgDisabled?: boolean;
  tableEnsured?: boolean;
  localVersion?: number;

  // Common state
  lastCheckedAt?: number;
  pendingFlushTimer?: ReturnType<typeof setTimeout> | null;
  activeSqlitePath?: string | null;
  rawClientGetter?: (() => any) | null;

  // Google Drive Real-Time WAL state
  walFileId?: string;
  accessToken?: string | null;
  tokenExpiresAt?: number;
  inFlightTokenPromise?: Promise<string | null> | null;
  lastDriveVersion?: string | null;
  appliedEntryIds?: Set<string>;
  pendingEntries?: WalEntry[];
  seqCounter?: number;
  inFlightPullPromise?: Promise<boolean> | null;
  pushQueuePromise?: Promise<void>;
  afterScheduled?: boolean;
}

const DEFAULT_WAL_FILE_ID = "175MkGtkerSbnU7QDsaIz0y3XdI9DHkY8";
const GOOGLE_DRIVE_FOLDER_ID = "1rpJPDuKMo8Tej0lk8LUAJxeGK4p4-wtr";
const WAL_FILENAME = "_gocab_realtime_wal.json";
const DEFAULT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbxqGFZzJ6-f7CQKCcezQMO3igElqACITRC7sAq7Y3EvOLLIrEp2O59JvgpNorQjPIngGg/exec";
const GOOGLE_SERVICE_ACCOUNT_EMAIL =
  "google-drive@gen-lang-client-0868678110.iam.gserviceaccount.com";

const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCyIhj5Hz6a1dbD
LO9EkbR97hoiOH9sRMZf9RNNmwxrVxvU8ApPAw8sBhQxOMlIiLMMViUVfaChVSUt
uvqbJLyPG6X45aspZNbkghxkcNLMAMkcN0MZ/WDW+On62RJ2LWy5S1NEfAPqhPb2
Y7ubFHRIwB/IAx6k4709vpTh+NFIciJdnKnjlMjRaVVQ+mGspoSMcGlndthyHg0u
4mAcFg+HE9G2f6tQnc4kLD96Uag0CQrEeaxhs6P1ZDLIvDUKQGQnvRaLqqXw9Fn5
Rw8C8pYUvYDaII7xiyLlLgBYegCUU/PEQTQPvf/B82vkkVWGQGOM/SxwFt2GsEXn
UvGX88PNAgMBAAECggEAUm6L/vCyAGXXad9n4+PHUgU2q8JYWQpkgHBBXAbVkvCv
DPV9171zLmyruHFuV/YGYT2WEKFfjXkA6O4fXV79MP5a6lihwdiLxxfcurApJEVy
y29ZSnQh9akfYblFHVH8/6w3XrhC+apJPJC/ds7a1vWtX1nuOuC2qJWCgSWq92ov
jDqyCgcqg2nH0rojTJbFK8okiPg6iMrNNaj62zrPlgd6M1o09y3zr/JYmcCE2/3T
QDoXaWtyTViWScCZp+2tSR/72IpHZqXoKzml7U9nK9lKP/7E/dOqRVKBaQpzMPIg
bh/shAMOGrNCsbe3fw1+gaX/xSBlMN+HhQVbOItKcwKBgQDlgQIDSnWe696Pra6D
CqjsJFrh1t92oyAYRSCz6QxPPnUy6P6r3JjJeboq1eq5HTAjZifC05kkJOuuX9LF
btBxORpYTOcGddneTDtAV9IXeNhC71NjVsoywD7Aw/fkcp46Tv4arMVA2OjS4Ywh
JSOXHoCGPFzK2NnbVQwncRyqYwKBgQDGstOeOPu9aO5Ludwnk0opwlBAi0EYo+SJ
OrBijXACWIFgzKovFnd3BPXM+cidSAuPvonDIowRvjjMPc29wE46lSYA+PeYiM4b
2+VvxeU2WJk1AmPiMNLs5yjewU+d8xP8+hos1Ne245gARvbT1L5/VCADG9/4oJZX
FaF+CumYDwKBgCfpQHVcDIpfkGvCE3gccXXneJqPqHrUMW+nDeHbpFVfkjgRRsCS
c0uOTK7IVrJsfgOZ7041SAt+FDJV3ayR8dPOz2MNtJtuAT5kWWV+ID4OuOUjA4hh
/nXG8uLI8aIbwKJ5PD1dUExPrGWH7buR3teX6VfuxWBNR82Zw6xUQlzrAoGBAI3u
45ccIUbVk5LoOsjSP6HAuc7BKkjNmcwk7iYX3jDuw8w/pjlolQGhu2sl6hXfhtKx
SnrnTKLH/I54f2TR34+dRr5fGY4N+xyPYT8MX4UImLfy8yJ5udGb9efYsmSjZF3K
0bPAfi6YONXJ2zrJtyIBF7TgzoYtP/cI7oi4htAlAoGBAJndFmGETkZ8ZfRfsU4j
mW23Sp0I1BcKnNcoK+kvviL5b4CQ3T6kDhNo5JLl/N8nl4kFtzD7bgYgXSBwCkok
86pc4C3xS8S9UpcDNaDxfQd2+ZLxUH1gnxhWa1sWd35kQV4ALlboztkmmoJQDP4q
H8C3qj1PipBONGputALVlcis
-----END PRIVATE KEY-----`;

const UNIQUE_FALLBACK_KEYS = [
  "id",
  "key",
  "phone_number",
  "sanitized_phone",
  "plate_number",
  "email",
  "cinNumber",
  "phoneSanitized",
  "ticketNumber",
  "assignedVehicleId",
] as const;

const gSync = globalThis as unknown as { __gocabSqliteSync?: SyncGlobalState };
if (!gSync.__gocabSqliteSync) {
  gSync.__gocabSqliteSync = {
    pgPool: undefined,
    pgDisabled: false,
    tableEnsured: false,
    localVersion: 0,
    lastCheckedAt: 0,
    pendingFlushTimer: null,
    activeSqlitePath: null,
    rawClientGetter: null,
    walFileId: process.env.GOCAB_WAL_DRIVE_FILE_ID || DEFAULT_WAL_FILE_ID,
    accessToken: null,
    tokenExpiresAt: 0,
    inFlightTokenPromise: null,
    lastDriveVersion: null,
    appliedEntryIds: new Set<string>(),
    pendingEntries: [],
    seqCounter: 0,
    inFlightPullPromise: null,
    pushQueuePromise: Promise.resolve(),
    afterScheduled: false,
  };
}
const state = gSync.__gocabSqliteSync!;

function ensureWalCollections(): void {
  if (!state.appliedEntryIds) state.appliedEntryIds = new Set<string>();
  if (!state.pendingEntries) state.pendingEntries = [];
  if (!state.walFileId) {
    state.walFileId = process.env.GOCAB_WAL_DRIVE_FILE_ID || DEFAULT_WAL_FILE_ID;
  }
  if (!state.pushQueuePromise) state.pushQueuePromise = Promise.resolve();
}

export function isCloudWalEnabled(): boolean {
  if (process.env.DISABLE_CLOUD_WAL === "true") return false;
  return Boolean(
    process.env.FORCE_CLOUD_WAL === "true" ||
      process.env.VERCEL ||
      process.cwd().startsWith("/var/task")
  );
}

function getPostgresUrl(): string | null {
  if (state.pgDisabled) return null;
  const candidates = [
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL,
  ];
  for (const c of candidates) {
    if (c && (c.startsWith("postgres://") || c.startsWith("postgresql://"))) {
      return c;
    }
  }
  return null;
}

function getPool(): Pool | null {
  const url = getPostgresUrl();
  if (!url) return null;
  if (state.pgPool) return state.pgPool;

  try {
    state.pgPool = new Pool({
      connectionString: url,
      max: 2,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 10000,
      ssl:
        url.includes("localhost") || url.includes("127.0.0.1")
          ? false
          : { rejectUnauthorized: false },
    });
    state.pgPool.on("error", () => {});
    return state.pgPool;
  } catch {
    state.pgDisabled = true;
    return null;
  }
}

async function ensureReplicaTable(pool: Pool): Promise<boolean> {
  if (state.tableEnsured) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _gocab_sqlite_replica (
        id INTEGER PRIMARY KEY,
        version BIGINT NOT NULL,
        data BYTEA NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    state.tableEnsured = true;
    return true;
  } catch {
    state.pgDisabled = true;
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic Cloning & Date-Safe WAL Serialization
// ─────────────────────────────────────────────────────────────────────────────

function deepClonePreserveSpecial(val: any): any {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return new Date(val.getTime());
  if (typeof val === "bigint") return val;
  if (Array.isArray(val)) return val.map(deepClonePreserveSpecial);
  if (typeof val === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = deepClonePreserveSpecial(v);
    }
    return out;
  }
  return val;
}

export function serializeForWal(val: any): any {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) {
    return { __gocab_date__: val.toISOString() };
  }
  if (typeof val === "bigint") {
    return { __gocab_bigint__: val.toString() };
  }
  if (Array.isArray(val)) {
    return val.map((item) => (item === undefined ? null : serializeForWal(item)));
  }
  if (typeof val === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        out[k] = serializeForWal(v);
      }
    }
    return out;
  }
  return val;
}

export function deserializeFromWal(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.map(deserializeFromWal);
  }
  if (typeof val === "object") {
    const keys = Object.keys(val);
    if (keys.length === 1 && typeof val.__gocab_date__ === "string") {
      return new Date(val.__gocab_date__);
    }
    if (keys.length === 1 && typeof val.__gocab_bigint__ === "string") {
      return BigInt(val.__gocab_bigint__);
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = deserializeFromWal(v);
    }
    return out;
  }
  return val;
}

/**
 * Deduplicates WAL entries by ID, preserves strict chronological ordering,
 * and compacts superseded `Setting` upserts (such as `data_sync_state`) so the
 * WAL remains lightweight regardless of polling/sync frequency.
 */
export function compactWalEntries(entries: WalEntry[]): WalEntry[] {
  const byId = new Map<string, WalEntry>();
  for (const e of entries) {
    if (e && typeof e.id === "string") {
      byId.set(e.id, e);
    }
  }

  const sorted = Array.from(byId.values()).sort(
    (a, b) => (a.ts - b.ts) || ((a.seq || 0) - (b.seq || 0))
  );

  // Track the latest index of `setting.upsert` for each setting key
  const latestSettingUpsertIdx = new Map<string, number>();
  sorted.forEach((entry, idx) => {
    if (entry.model === "setting" && entry.method === "upsert") {
      const settingKey = entry.args?.[0]?.where?.key;
      if (typeof settingKey === "string" && settingKey.length > 0) {
        latestSettingUpsertIdx.set(settingKey, idx);
      }
    }
  });

  return sorted.filter((entry, idx) => {
    if (entry.model === "setting" && entry.method === "upsert") {
      const settingKey = entry.args?.[0]?.where?.key;
      if (typeof settingKey === "string" && settingKey.length > 0) {
        return latestSettingUpsertIdx.get(settingKey) === idx;
      }
    }
    return true;
  });
}

/**
 * Ensures deterministic primary keys (`id`) on `create`, `upsert`, and `createMany`
 * before executing locally so every Serverless container replays the exact same UUIDs.
 */
export function prepareDeterministicWriteArgs(
  model: string,
  method: string,
  args: any[]
): any[] {
  const cloned = deepClonePreserveSpecial(args);
  if (model === "setting") return cloned;

  const first = cloned[0];
  if (!first || typeof first !== "object") return cloned;

  if (method === "create" && first.data && typeof first.data === "object") {
    if (!first.data.id) {
      first.data.id = crypto.randomUUID();
    }
  } else if (method === "upsert" && first.create && typeof first.create === "object") {
    if (!first.create.id) {
      first.create.id = crypto.randomUUID();
    }
  } else if (
    (method === "createMany" || method === "createManyAndReturn") &&
    Array.isArray(first.data)
  ) {
    for (const row of first.data) {
      if (row && typeof row === "object" && !row.id) {
        row.id = crypto.randomUUID();
      }
    }
  }

  return cloned;
}

/**
 * Records a completed write operation into the in-memory pending WAL buffer
 * and marks it applied for the current SQLite database instance.
 */
export function recordWalEntry(
  model: string,
  method: string,
  preparedArgs: any[],
  result?: any
): WalEntry | null {
  if (!isCloudWalEnabled() || Boolean(getPostgresUrl())) {
    return null;
  }

  ensureWalCollections();

  const recordedArgs = deepClonePreserveSpecial(preparedArgs);
  const first = recordedArgs[0];
  if (first && typeof first === "object") {
    delete first.include;
    delete first.select;

    if (result && typeof result === "object" && !Array.isArray(result)) {
      if (method === "create" && first.data && typeof first.data === "object") {
        for (const [k, v] of Object.entries(result)) {
          if (v instanceof Date && first.data[k] === undefined) {
            first.data[k] = new Date(v.getTime());
          }
        }
      } else if (method === "upsert") {
        if (first.create && typeof first.create === "object") {
          for (const [k, v] of Object.entries(result)) {
            if (v instanceof Date && first.create[k] === undefined) {
              first.create[k] = new Date(v.getTime());
            }
          }
        }
        if (first.update && typeof first.update === "object") {
          resolveAtomicNumericOps(first.update, result);
        }
      } else if (method === "update" && first.data && typeof first.data === "object") {
        resolveAtomicNumericOps(first.data, result);
        if (result.updated_at instanceof Date && first.data.updated_at === undefined) {
          first.data.updated_at = new Date(result.updated_at.getTime());
        }
        if (result.updatedAt instanceof Date && first.data.updatedAt === undefined) {
          first.data.updatedAt = new Date(result.updatedAt.getTime());
        }
      }
    }
  }

  state.seqCounter = (state.seqCounter || 0) + 1;
  const entry: WalEntry = {
    id: crypto.randomUUID(),
    seq: state.seqCounter,
    ts: Date.now(),
    model,
    method,
    args: serializeForWal(recordedArgs),
  };

  state.appliedEntryIds!.add(entry.id);
  state.pendingEntries!.push(entry);
  return entry;
}

function resolveAtomicNumericOps(dataObj: Record<string, any>, result: Record<string, any>): void {
  for (const [k, v] of Object.entries(dataObj)) {
    if (
      v &&
      typeof v === "object" &&
      !(v instanceof Date) &&
      ("increment" in v || "decrement" in v || "multiply" in v || "divide" in v) &&
      typeof result[k] === "number"
    ) {
      dataObj[k] = result[k];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Drive OAuth2 & File Operations (50-Minute Cached Bearer Token)
// ─────────────────────────────────────────────────────────────────────────────

async function getCachedDriveAccessToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now();
  if (
    !forceRefresh &&
    state.accessToken &&
    state.tokenExpiresAt &&
    state.tokenExpiresAt > now
  ) {
    return state.accessToken;
  }

  if (!forceRefresh && state.inFlightTokenPromise) {
    return state.inFlightTokenPromise;
  }

  const p = (async () => {
    try {
      const privateKey = (
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || DEFAULT_PRIVATE_KEY
      ).replace(/\\n/g, "\n");
      const clientEmail =
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || GOOGLE_SERVICE_ACCOUNT_EMAIL;
      if (!privateKey || !clientEmail) return null;

      const iat = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
        "base64url"
      );
      const claimSet = Buffer.from(
        JSON.stringify({
          iss: clientEmail,
          scope: "https://www.googleapis.com/auth/drive",
          aud: "https://oauth2.googleapis.com/token",
          exp: iat + 3600,
          iat,
        })
      ).toString("base64url");

      const signer = crypto.createSign("RSA-SHA256");
      signer.update(header + "." + claimSet);
      const signature = signer.sign(privateKey, "base64url");
      const jwt = `${header}.${claimSet}.${signature}`;

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=${encodeURIComponent(
          "urn:ietf:params:oauth:grant-type:jwt-bearer"
        )}&assertion=${encodeURIComponent(jwt)}`,
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data?.access_token) {
        state.accessToken = data.access_token;
        // Cache for 50 minutes (token valid for 60 minutes)
        state.tokenExpiresAt = Date.now() + 50 * 60 * 1000;
        return data.access_token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      state.inFlightTokenPromise = null;
    }
  })();

  state.inFlightTokenPromise = p;
  return p;
}

async function resolveOrRecreateWalFileId(token: string): Promise<string | null> {
  try {
    // 1. Search shared folder for existing _gocab_realtime_wal.json
    const q = encodeURIComponent(
      `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and name = '${WAL_FILENAME}' and trashed = false`
    );
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      if (listData?.files?.[0]?.id) {
        state.walFileId = listData.files[0].id;
        return state.walFileId!;
      }
    }

    // 2. Recreate via Apps Script Webhook (uses owner's 5 TB quota)
    const emptyDoc: WalDocument = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [],
    };
    await fetch(DEFAULT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        timestamp: emptyDoc.updatedAt,
        source: "GoCab Cloud WAL Init",
        files: [
          {
            filename: WAL_FILENAME,
            mimeType: "application/json",
            content: JSON.stringify(emptyDoc),
          },
        ],
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    const verifyRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json();
      if (verifyData?.files?.[0]?.id) {
        state.walFileId = verifyData.files[0].id;
        return state.walFileId!;
      }
    }
  } catch {
    // Ignore fallback errors
  }
  return null;
}

async function driveFetchWithRetry(
  urlBuilder: (fileId: string) => string,
  init: RequestInit
): Promise<Response | null> {
  ensureWalCollections();
  let token = await getCachedDriveAccessToken(false);
  if (!token) return null;

  let fileId = state.walFileId || DEFAULT_WAL_FILE_ID;
  let res = await fetch(urlBuilder(fileId), {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);

  if (res && res.status === 401) {
    token = await getCachedDriveAccessToken(true);
    if (!token) return null;
    res = await fetch(urlBuilder(fileId), {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
  }

  if (res && res.status === 404) {
    const recoveredId = await resolveOrRecreateWalFileId(token);
    if (recoveredId) {
      fileId = recoveredId;
      res = await fetch(urlBuilder(fileId), {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      }).catch(() => null);
    }
  }

  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAL Replay & Synchronization Engine
// ─────────────────────────────────────────────────────────────────────────────

function invalidateGlobalInMemoryCaches(): void {
  const g = globalThis as any;
  g.__gocabLeadsCache = null;
  g.__gocabDriverCache = null;
  g.syncCacheExpiresAt = 0;
}

export async function replayWalEntriesOntoClient(
  rawClient: any,
  entries: WalEntry[]
): Promise<number> {
  if (!rawClient || !Array.isArray(entries) || entries.length === 0) return 0;
  ensureWalCollections();

  const unseen = entries.filter(
    (e) => e && typeof e.id === "string" && !state.appliedEntryIds!.has(e.id)
  );
  if (unseen.length === 0) return 0;

  let replayed = 0;
  for (const entry of unseen) {
    const delegate = rawClient[entry.model];
    if (!delegate || typeof delegate[entry.method] !== "function") {
      state.appliedEntryIds!.add(entry.id);
      continue;
    }

    const args = deserializeFromWal(entry.args || []);

    if (entry.method === "create") {
      try {
        await delegate.create(args[0]);
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (err?.code === "P2002" || msg.includes("UNIQUE constraint failed")) {
          const data = args[0]?.data;
          if (data && typeof data === "object") {
            const { id: _omitId, ...restData } = data;
            for (const uk of UNIQUE_FALLBACK_KEYS) {
              if (data[uk] !== undefined && data[uk] !== null) {
                try {
                  await delegate.update({
                    where: { [uk]: data[uk] },
                    data: uk === "id" || uk === "key" ? data : restData,
                  });
                  break;
                } catch {
                  // Try next unique key if applicable
                }
              }
            }
          }
        } else {
          console.warn(`[CloudWAL] Replay create warning on ${entry.model}:`, msg);
        }
      }
    } else if (
      entry.method === "createMany" ||
      entry.method === "createManyAndReturn"
    ) {
      try {
        await delegate.createMany(args[0]);
      } catch {
        const rows = Array.isArray(args[0]?.data) ? args[0].data : [];
        for (const row of rows) {
          try {
            await delegate.create({ data: row });
          } catch {
            // Ignore duplicate row
          }
        }
      }
    } else if (entry.method === "update" || entry.method === "delete") {
      try {
        await delegate[entry.method](...args);
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (
          err?.code !== "P2025" &&
          !msg.includes("Record to update not found") &&
          !msg.includes("Record to delete does not exist")
        ) {
          console.warn(
            `[CloudWAL] Replay ${entry.method} warning on ${entry.model}:`,
            msg
          );
        }
      }
    } else {
      try {
        await delegate[entry.method](...args);
      } catch (err: any) {
        console.warn(
          `[CloudWAL] Replay ${entry.method} warning on ${entry.model}:`,
          err?.message || err
        );
      }
    }

    state.appliedEntryIds!.add(entry.id);
    replayed++;
  }

  if (replayed > 0) {
    invalidateGlobalInMemoryCaches();
  }

  return replayed;
}

/**
 * Pulls and replays any unseen Google Drive WAL entries onto `rawClient`.
 * Coalesces concurrent intra-request checks and uses a 150ms metadata window
 * so multi-query handlers only perform 1 lightweight metadata check (~45ms),
 * while cross-container mutations are visible immediately on the next request.
 */
export async function syncCloudWalToClient(
  rawClient: any,
  force = false
): Promise<boolean> {
  if (!rawClient || !isCloudWalEnabled() || Boolean(getPostgresUrl())) {
    return false;
  }

  ensureWalCollections();

  if (state.inFlightPullPromise) {
    return state.inFlightPullPromise;
  }

  const now = Date.now();
  if (!force && state.lastCheckedAt && now - state.lastCheckedAt < 150) {
    return false;
  }

  const pullTask = (async () => {
    try {
      const metaRes = await driveFetchWithRetry(
        (id) =>
          `https://www.googleapis.com/drive/v3/files/${id}?fields=id,version,modifiedTime`,
        { method: "GET" }
      );
      if (!metaRes || !metaRes.ok) {
        state.lastCheckedAt = Date.now();
        return false;
      }

      const meta = await metaRes.json().catch(() => null);
      const remoteVersionKey = meta
        ? `${meta.version || ""}:${meta.modifiedTime || ""}`
        : null;

      if (
        remoteVersionKey &&
        state.lastDriveVersion &&
        remoteVersionKey === state.lastDriveVersion
      ) {
        state.lastCheckedAt = Date.now();
        return false;
      }

      const mediaRes = await driveFetchWithRetry(
        (id) => `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
        { method: "GET" }
      );
      if (!mediaRes || !mediaRes.ok) {
        state.lastCheckedAt = Date.now();
        return false;
      }

      const doc = (await mediaRes.json().catch(() => null)) as WalDocument | null;
      const entries = Array.isArray(doc?.entries) ? doc!.entries : [];
      const replayed = await replayWalEntriesOntoClient(rawClient, entries);

      if (remoteVersionKey) {
        state.lastDriveVersion = remoteVersionKey;
      }
      state.lastCheckedAt = Date.now();
      return replayed > 0;
    } catch {
      state.lastCheckedAt = Date.now();
      return false;
    } finally {
      state.inFlightPullPromise = null;
    }
  })();

  state.inFlightPullPromise = pullTask;
  return pullTask;
}

export function registerActiveSqlitePath(
  sqlitePath: string,
  rawClientGetter?: () => any
): void {
  ensureWalCollections();
  if (state.activeSqlitePath !== sqlitePath) {
    state.activeSqlitePath = sqlitePath;
    state.appliedEntryIds = new Set<string>();
    state.lastDriveVersion = null;
    state.lastCheckedAt = 0;
  }
  if (rawClientGetter) {
    state.rawClientGetter = rawClientGetter;
  }
}

/**
 * Checks if a newer full SQLite snapshot exists in Postgres (when POSTGRES_URL is configured).
 */
export async function pullSqliteSnapshotIfNewer(
  sqlitePath: string,
  force = false
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  const now = Date.now();
  if (!force && state.lastCheckedAt && now - state.lastCheckedAt < 2000) {
    return false;
  }
  state.lastCheckedAt = now;

  if (!(await ensureReplicaTable(pool))) return false;

  try {
    const metaRes = await pool.query(
      "SELECT version FROM _gocab_sqlite_replica WHERE id = 1"
    );
    if (metaRes.rowCount === 0) {
      if (fs.existsSync(sqlitePath)) {
        await pushSqliteSnapshotNow(sqlitePath);
      }
      return false;
    }

    const remoteVersion = Number(metaRes.rows[0].version || 0);
    if (remoteVersion <= (state.localVersion || 0)) {
      return false;
    }

    const dataRes = await pool.query(
      "SELECT version, data FROM _gocab_sqlite_replica WHERE id = 1"
    );
    if (dataRes.rowCount === 0 || !dataRes.rows[0].data) return false;

    const decompressed = zlib.gunzipSync(dataRes.rows[0].data);
    const tmpWrite = `${sqlitePath}.sync-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpWrite, decompressed);
    fs.renameSync(tmpWrite, sqlitePath);
    state.localVersion = Number(dataRes.rows[0].version || remoteVersion);
    invalidateGlobalInMemoryCaches();
    return true;
  } catch {
    return false;
  }
}

async function flushPendingWalToDrive(): Promise<void> {
  ensureWalCollections();
  if (!state.pendingEntries || state.pendingEntries.length === 0) {
    return;
  }

  const batch = state.pendingEntries.splice(0, state.pendingEntries.length);

  try {
    // 1. Read latest remote WAL so concurrent writes from other Lambdas are merged
    let remoteEntries: WalEntry[] = [];
    const mediaRes = await driveFetchWithRetry(
      (id) => `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { method: "GET" }
    );
    if (mediaRes && mediaRes.ok) {
      const doc = (await mediaRes.json().catch(() => null)) as WalDocument | null;
      if (Array.isArray(doc?.entries)) {
        remoteEntries = doc!.entries;
      }
    }

    // Replay any unseen remote entries onto local client as well
    const rawClient = state.rawClientGetter?.();
    if (rawClient && remoteEntries.length > 0) {
      await replayWalEntriesOntoClient(rawClient, remoteEntries);
    }

    // 2. Merge & compact remote + local batch
    const mergedEntries = compactWalEntries([...remoteEntries, ...batch]);
    const payload: WalDocument = {
      version: Date.now(),
      updatedAt: new Date().toISOString(),
      entries: mergedEntries,
    };

    const uploadRes = await driveFetchWithRetry(
      (id) =>
        `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=id,version,modifiedTime`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify(payload),
      }
    );

    if (!uploadRes || !uploadRes.ok) {
      // Re-queue batch at front so a transient network hiccup never drops mutations
      state.pendingEntries!.unshift(...batch);
      return;
    }

    const updatedMeta = await uploadRes.json().catch(() => null);
    if (updatedMeta) {
      state.lastDriveVersion = `${updatedMeta.version || ""}:${
        updatedMeta.modifiedTime || ""
      }`;
    }
    state.lastCheckedAt = Date.now();
  } catch {
    state.pendingEntries!.unshift(...batch);
  }
}

/**
 * Immediately flushes pending mutations to cross-container cloud storage
 * (Google Drive Real-Time WAL or Postgres snapshot replica).
 */
export async function pushSqliteSnapshotNow(sqlitePath?: string): Promise<void> {
  if (state.pendingFlushTimer) {
    clearTimeout(state.pendingFlushTimer);
    state.pendingFlushTimer = null;
  }

  const pool = getPool();
  if (pool) {
    const targetPath = sqlitePath || state.activeSqlitePath;
    if (!targetPath) return;
    if (!(await ensureReplicaTable(pool))) return;

    try {
      if (!fs.existsSync(targetPath)) return;

      try {
        const { createClient } = require("@libsql/client");
        const chkClient = createClient({
          url: `file:${targetPath.replace(/\\/g, "/")}`,
        });
        await chkClient.execute("PRAGMA wal_checkpoint(PASSIVE);").catch(() => {});
      } catch {}

      const raw = fs.readFileSync(targetPath);
      const compressed = zlib.gzipSync(raw, { level: 6 });
      const newVersion = Date.now();

      await pool.query(
        `INSERT INTO _gocab_sqlite_replica (id, version, data, updated_at)
         VALUES (1, $1, $2, NOW())
         ON CONFLICT (id) DO UPDATE
         SET version = EXCLUDED.version, data = EXCLUDED.data, updated_at = NOW()`,
        [newVersion, compressed]
      );
      state.localVersion = newVersion;
      state.lastCheckedAt = newVersion;
    } catch {
      // Non-fatal
    }
    return;
  }

  if (!isCloudWalEnabled()) return;

  ensureWalCollections();
  const nextPush = state.pushQueuePromise!.then(
    () => flushPendingWalToDrive(),
    () => flushPendingWalToDrive()
  );
  state.pushQueuePromise = nextPush;
  await nextPush;
}

/**
 * Schedules a guaranteed background flush for any route that mutates records
 * without explicitly calling `touchSyncState()` / `flushDatabaseSync()`.
 * Uses Next.js `after()` to keep the Vercel Lambda alive until the WAL push
 * completes, with a timer fallback for non-request contexts.
 */
export function scheduleSqliteSnapshotPush(): void {
  if (!isCloudWalEnabled() && !getPostgresUrl()) return;

  if (!state.afterScheduled) {
    state.afterScheduled = true;
    try {
      after(async () => {
        state.afterScheduled = false;
        await pushSqliteSnapshotNow();
      });
    } catch {
      // Called outside Next.js request scope (e.g. CLI / tests)
      state.afterScheduled = false;
    }
  }

  if (state.pendingFlushTimer) {
    clearTimeout(state.pendingFlushTimer);
  }
  state.pendingFlushTimer = setTimeout(() => {
    state.pendingFlushTimer = null;
    void pushSqliteSnapshotNow();
  }, 800);
}
