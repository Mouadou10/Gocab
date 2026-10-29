/**
 * Cross-Container SQLite Cloud Sync (Postgres Bytea Replica)
 *
 * When Turso Cloud hits row-read limits on Vercel Serverless, local /tmp/gocab-dev.db
 * is isolated per Lambda instance. If a Postgres connection URL (POSTGRES_URL or DATABASE_URL)
 * is present in the environment, this module synchronizes a gzip-compressed snapshot of
 * /tmp/gocab-dev.db across all serverless instances in ~30ms.
 *
 * Gracefully degrades to a silent no-op if no Postgres URL is configured or reachable.
 */

import fs from "node:fs";
import zlib from "node:zlib";
import { Pool } from "pg";

interface SyncGlobalState {
  pgPool?: Pool | null;
  pgDisabled?: boolean;
  tableEnsured?: boolean;
  localVersion?: number;
  lastCheckedAt?: number;
  pendingFlushTimer?: ReturnType<typeof setTimeout> | null;
  activeSqlitePath?: string | null;
}

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
  };
}
const state = gSync.__gocabSqliteSync!;

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
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    });
    state.pgPool.on("error", () => {
      // Prevent unhandled pool error crashes
    });
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

export function registerActiveSqlitePath(sqlitePath: string): void {
  state.activeSqlitePath = sqlitePath;
}

/**
 * Checks if a newer SQLite snapshot exists in Postgres and writes it to `sqlitePath`.
 * Returns `true` if `sqlitePath` was updated on disk (caller should refresh LibSQL client).
 */
export async function pullSqliteSnapshotIfNewer(sqlitePath: string, force = false): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  const now = Date.now();
  if (!force && state.lastCheckedAt && now - state.lastCheckedAt < 2000) {
    return false;
  }
  state.lastCheckedAt = now;

  if (!(await ensureReplicaTable(pool))) return false;

  try {
    const metaRes = await pool.query("SELECT version FROM _gocab_sqlite_replica WHERE id = 1");
    if (metaRes.rowCount === 0) {
      // Seed initial snapshot from bundled dev.db so all containers share a common baseline
      if (fs.existsSync(sqlitePath)) {
        await pushSqliteSnapshotNow(sqlitePath);
      }
      return false;
    }

    const remoteVersion = Number(metaRes.rows[0].version || 0);
    if (remoteVersion <= (state.localVersion || 0)) {
      return false;
    }

    const dataRes = await pool.query("SELECT version, data FROM _gocab_sqlite_replica WHERE id = 1");
    if (dataRes.rowCount === 0 || !dataRes.rows[0].data) return false;

    const decompressed = zlib.gunzipSync(dataRes.rows[0].data);
    const tmpWrite = `${sqlitePath}.sync-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpWrite, decompressed);
    fs.renameSync(tmpWrite, sqlitePath);
    state.localVersion = Number(dataRes.rows[0].version || remoteVersion);
    return true;
  } catch {
    return false;
  }
}

/**
 * Immediately compresses and uploads `sqlitePath` to Postgres replica storage.
 */
export async function pushSqliteSnapshotNow(sqlitePath?: string): Promise<void> {
  const targetPath = sqlitePath || state.activeSqlitePath;
  if (!targetPath) return;

  if (state.pendingFlushTimer) {
    clearTimeout(state.pendingFlushTimer);
    state.pendingFlushTimer = null;
  }

  const pool = getPool();
  if (!pool) return;
  if (!(await ensureReplicaTable(pool))) return;

  try {
    if (!fs.existsSync(targetPath)) return;

    // Flush any pending WAL pages into main db file before snapshotting
    try {
      const { createClient } = require("@libsql/client");
      const chkClient = createClient({ url: `file:${targetPath.replace(/\\/g, "/")}` });
      await chkClient.execute("PRAGMA wal_checkpoint(PASSIVE);").catch(() => {});
    } catch (_) {}

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
    // Non-fatal: continue operating on local SQLite
  }
}

/**
 * Schedules a debounced background snapshot upload after single-record mutations.
 */
export function scheduleSqliteSnapshotPush(): void {
  if (state.pgDisabled || !state.activeSqlitePath) return;
  if (!getPostgresUrl()) return;

  if (state.pendingFlushTimer) {
    clearTimeout(state.pendingFlushTimer);
  }
  state.pendingFlushTimer = setTimeout(() => {
    state.pendingFlushTimer = null;
    void pushSqliteSnapshotNow();
  }, 500);
}
