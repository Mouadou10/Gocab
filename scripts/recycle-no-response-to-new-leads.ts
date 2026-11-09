import Database from "better-sqlite3";
import path from "path";

const localDb = new Database(path.join(process.cwd(), "dev.db"));

const TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io/v2/pipeline";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";

async function executeTurso(sql: string, params: any[] = []) {
  const res = await fetch(TURSO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: params.map((p) => {
              if (p === null || p === undefined) return { type: "null" };
              if (typeof p === "number") return { type: "integer", value: String(p) };
              return { type: "text", value: String(p) };
            }),
          },
        },
      ],
    }),
  });

  const body = await res.json();
  const r = body.results?.[0];
  if (r?.type === "error") {
    throw new Error(`Turso SQL error: ${r.error.message}`);
  }
  return r?.response?.result;
}

async function main() {
  const nowIso = new Date().toISOString();
  console.log("Recycling No response 1 and No response 2 into NEW_LEADS at:", nowIso);

  // 1. Update Local dev.db
  console.log("\n--- Updating Local dev.db ---");
  const localBefore = localDb.prepare(`
    SELECT count(*) as count FROM Lead 
    WHERE LOWER(brand_status) IN ('no response 1', 'no response 2')
  `).get() as { count: number };
  console.log(`Found ${localBefore.count} matching leads in local dev.db`);

  const localUpdate = localDb.prepare(`
    UPDATE Lead
    SET board_column = 'NEW_LEADS',
        brand_status = NULL,
        training_status = NULL,
        reminder_date = NULL,
        status_changed_at = NULL,
        updated_at = ?
    WHERE LOWER(brand_status) IN ('no response 1', 'no response 2')
  `).run(nowIso);
  console.log(`Local dev.db updated rows: ${localUpdate.changes}`);

  const localNewLeadsAfter = localDb.prepare(`
    SELECT count(*) as count FROM Lead WHERE board_column = 'NEW_LEADS'
  `).get() as { count: number };
  console.log(`Total NEW_LEADS in local dev.db now: ${localNewLeadsAfter.count}`);

  // 2. Update Production Turso
  console.log("\n--- Updating Production Turso Cloud ---");
  const tursoBefore = await executeTurso(`
    SELECT count(*) as count FROM Lead 
    WHERE LOWER(brand_status) IN ('no response 1', 'no response 2')
  `);
  const tursoCountBefore = tursoBefore?.rows?.[0]?.[0]?.value || 0;
  console.log(`Found ${tursoCountBefore} matching leads in Turso`);

  const tursoUpdate = await executeTurso(`
    UPDATE Lead
    SET board_column = 'NEW_LEADS',
        brand_status = NULL,
        training_status = NULL,
        reminder_date = NULL,
        status_changed_at = NULL,
        updated_at = ?
    WHERE LOWER(brand_status) IN ('no response 1', 'no response 2')
  `, [nowIso]);
  console.log(`Turso updated affected rows: ${tursoUpdate?.affected_row_count}`);

  const tursoAfter = await executeTurso(`
    SELECT board_column, count(*) as count FROM Lead GROUP BY board_column
  `);
  console.log("Turso board_column breakdown now:");
  tursoAfter?.rows?.forEach((row: any) => {
    console.log(`  - ${row[0]?.value}: ${row[1]?.value}`);
  });

  // 3. Update Sync State in Turso to trigger instant LiveSync broadcast
  const nowMs = Date.now();
  console.log("\n--- Broadcasting Mutation via Sync State ---");
  const syncStateJson = JSON.stringify({
    leads: nowMs,
    tickets: nowMs,
    settings: nowMs,
    collections: nowMs,
    version: String(nowMs),
    updatedAt: nowMs,
  });

  // Local setting
  localDb.prepare(`
    INSERT INTO Setting (key, value) VALUES ('data_sync_state', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(syncStateJson);

  // Turso setting
  await executeTurso(`
    INSERT INTO Setting (key, value) VALUES ('data_sync_state', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `, [syncStateJson]);

  console.log("Successfully broadcasted sync state to all clients!");
  console.log("All No response 1 & 2 leads are now active in NEW_LEADS!");
}

main().catch(console.error);
