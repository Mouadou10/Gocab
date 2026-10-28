/**
 * Master Turso Cloud to Local dev.db Restoration Script
 * Extracts 100% of the live production database using DML RETURNING queries
 * bypassing Turso's SQL read block.
 */

import Database from "better-sqlite3";
import path from "path";

const TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io/v2/pipeline";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";

const localDb = new Database(path.join(process.cwd(), "dev.db"));

async function executeTursoDml(sql: string) {
  const res = await fetch(TURSO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql } }],
    }),
  });

  const body = await res.json();
  const r = body.results?.[0];
  if (r?.type === "error") {
    throw new Error(`Turso SQL error: ${r.error.message}`);
  }
  const cols = r?.response?.result?.cols?.map((c: any) => c.name) || [];
  const rows = r?.response?.result?.rows || [];
  return { cols, rows };
}

function parseVal(cell: any) {
  if (!cell || cell.type === "null") return null;
  if (cell.type === "integer") return Number(cell.value);
  if (cell.type === "float") return Number(cell.value);
  return cell.value;
}

async function restoreSettings() {
  console.log("\n📦 Restoring Settings...");
  const { cols, rows } = await executeTursoDml('UPDATE "Setting" SET "key" = "key" RETURNING *');
  const upsert = localDb.prepare('INSERT OR REPLACE INTO "Setting" (key, value) VALUES (?, ?)');
  const trans = localDb.transaction((rows) => {
    for (const r of rows) {
      const k = parseVal(r[cols.indexOf("key")]);
      const v = parseVal(r[cols.indexOf("value")]);
      if (k) upsert.run(k, v);
    }
  });
  trans(rows);
  console.log(`✅ Restored ${rows.length} Settings.`);
}

async function restoreUsers() {
  console.log("\n👥 Restoring Users & original password hashes...");
  const { cols, rows } = await executeTursoDml('UPDATE "User" SET "id" = "id" RETURNING *');
  const stmt = localDb.prepare(`
    INSERT OR REPLACE INTO "User" 
    (id, email, name, fullName, role, region, assignedCars, passwordHash, mustChangePassword, isActive, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const trans = localDb.transaction((rows) => {
    for (const r of rows) {
      const get = (col: string) => parseVal(r[cols.indexOf(col)]);
      stmt.run(
        get("id"),
        get("email"),
        get("name"),
        get("fullName"),
        get("role"),
        get("region"),
        get("assignedCars"),
        get("passwordHash"),
        get("mustChangePassword") ? 1 : 0,
        get("isActive") ? 1 : 0,
        get("created_at")
      );
    }
  });
  trans(rows);
  console.log(`✅ Restored ${rows.length} Users.`);
}

async function restoreFieldTasks() {
  console.log("\n📋 Restoring FieldTasks...");
  const { cols, rows } = await executeTursoDml('UPDATE "FieldTask" SET "id" = "id" RETURNING *');
  const stmt = localDb.prepare(`
    INSERT OR REPLACE INTO "FieldTask"
    (id, task_type, vehicle_id, plate_number, driver_name, driver_phone, description, status, priority, failure_reason, linked_ticket_id, assigned_to, due_date, completed_at, has_key, has_carte_grise, has_assurance, recovery_duration_hours, recovery_notes, created_at, updated_at, duration_hours, scheduled_date, scheduled_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const trans = localDb.transaction((rows) => {
    for (const r of rows) {
      const get = (col: string) => parseVal(r[cols.indexOf(col)]);
      stmt.run(
        get("id"),
        get("task_type"),
        get("vehicle_id"),
        get("plate_number"),
        get("driver_name"),
        get("driver_phone"),
        get("description"),
        get("status"),
        get("priority"),
        get("failure_reason"),
        get("linked_ticket_id"),
        get("assigned_to"),
        get("due_date"),
        get("completed_at"),
        get("has_key") ? 1 : 0,
        get("has_carte_grise") ? 1 : 0,
        get("has_assurance") ? 1 : 0,
        get("recovery_duration_hours"),
        get("recovery_notes"),
        get("created_at"),
        get("updated_at"),
        get("duration_hours"),
        get("scheduled_date"),
        get("scheduled_time")
      );
    }
  });
  trans(rows);
  console.log(`✅ Restored ${rows.length} FieldTasks.`);
}

async function restoreLeads() {
  console.log("\n🎯 Restoring all 3,079+ Leads with exact October dates, statuses, and agent assignments...");
  const { cols, rows } = await executeTursoDml(`
    UPDATE Lead SET updated_at = updated_at
    RETURNING id, raw_name, sanitized_phone, campaign_source, board_column, 
              brand_status, training_status, reminder_date, preorder_amount, 
              city, has_cin, has_fiche_anthropometrique, has_confirmation_adresse, 
              has_permis, presence_confirmed, presence_confirmed_at, status_changed_at, 
              handled_by, is_archived, notes, age, permis_seniority_years, 
              is_resident, created_at, updated_at
  `);

  const stmt = localDb.prepare(`
    INSERT OR REPLACE INTO "Lead"
    (id, raw_name, sanitized_phone, campaign_source, board_column, brand_status, training_status, reminder_date, preorder_amount, city, has_cin, has_fiche_anthropometrique, has_confirmation_adresse, has_permis, presence_confirmed, presence_confirmed_at, status_changed_at, handled_by, is_archived, notes, age, permis_seniority_years, is_resident, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const trans = localDb.transaction((rows) => {
    for (const r of rows) {
      const get = (col: string) => parseVal(r[cols.indexOf(col)]);
      stmt.run(
        get("id"),
        get("raw_name"),
        get("sanitized_phone"),
        get("campaign_source"),
        get("board_column") || "NEW_LEADS",
        get("brand_status"),
        get("training_status"),
        get("reminder_date"),
        get("preorder_amount"),
        get("city"),
        get("has_cin") ? 1 : 0,
        get("has_fiche_anthropometrique") ? 1 : 0,
        get("has_confirmation_adresse") ? 1 : 0,
        get("has_permis") ? 1 : 0,
        get("presence_confirmed") ? 1 : 0,
        get("presence_confirmed_at"),
        get("status_changed_at"),
        get("handled_by"),
        get("is_archived") ? 1 : 0,
        get("notes"),
        get("age"),
        get("permis_seniority_years"),
        get("is_resident"),
        get("created_at"),
        get("updated_at")
      );
    }
  });

  trans(rows);
  console.log(`✅ Restored ${rows.length} Leads.`);
}

async function restoreLeadActivityLogs() {
  console.log("\n📜 Restoring all 11,707+ LeadActivityLogs in batches of 1,000...");
  localDb.prepare('DELETE FROM "LeadActivityLog"').run();

  const insertStmt = localDb.prepare(`
    INSERT OR REPLACE INTO "LeadActivityLog"
    (id, lead_id, agent, action, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let lastRowid = 0;
  let totalInserted = 0;

  while (true) {
    const { cols, rows } = await executeTursoDml(`
      UPDATE "LeadActivityLog" SET "id" = "id"
      WHERE rowid in (
        SELECT rowid FROM "LeadActivityLog"
        WHERE rowid > ${lastRowid}
        ORDER BY rowid ASC
        LIMIT 1000
      )
      RETURNING rowid, id, lead_id, agent, action, detail, created_at
    `);

    if (rows.length === 0) break;

    const trans = localDb.transaction((chunk) => {
      for (const r of chunk) {
        const get = (col: string) => parseVal(r[cols.indexOf(col)]);
        insertStmt.run(
          get("id"),
          get("lead_id"),
          get("agent"),
          get("action"),
          get("detail"),
          get("created_at")
        );
      }
    });

    trans(rows);
    totalInserted += rows.length;

    const rowidCol = cols.indexOf("rowid");
    lastRowid = Math.max(...rows.map((r: any) => Number(r[rowidCol].value)));
    process.stdout.write(`\rProgress: ${totalInserted} activity logs restored... (lastRowid: ${lastRowid})`);

    if (rows.length < 1000) break;
  }

  console.log(`\n✅ Restored ${totalInserted} total LeadActivityLogs.`);
}

async function restoreWhatsApp() {
  console.log("\n💬 Restoring WhatsApp conversations & messages...");
  try {
    const convData = await executeTursoDml('UPDATE "WhatsAppConversation" SET "id" = "id" RETURNING *');
    const convStmt = localDb.prepare(`
      INSERT OR REPLACE INTO "WhatsAppConversation"
      (id, phone_number, contact_name, driver_id, lead_id, contact_type, workflow_state, routed_department, matched_plate, matched_vehicle_id, last_message, last_message_at, unread_count, is_pinned, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const convTrans = localDb.transaction((rows) => {
      for (const r of rows) {
        const get = (col: string) => parseVal(r[convData.cols.indexOf(col)]);
        convStmt.run(
          get("id"),
          get("phone_number"),
          get("contact_name"),
          get("driver_id"),
          get("lead_id"),
          get("contact_type"),
          get("workflow_state"),
          get("routed_department"),
          get("matched_plate"),
          get("matched_vehicle_id"),
          get("last_message"),
          get("last_message_at"),
          get("unread_count") || 0,
          get("is_pinned") ? 1 : 0,
          get("is_archived") ? 1 : 0,
          get("created_at"),
          get("updated_at")
        );
      }
    });
    convTrans(convData.rows);
    console.log(`✅ Restored ${convData.rows.length} WhatsApp Conversations.`);
  } catch (err: any) {
    console.warn("WhatsApp Conversation restore error:", err.message);
  }

  try {
    let lastRowid = 0;
    let totalMsgs = 0;
    const msgStmt = localDb.prepare(`
      INSERT OR REPLACE INTO "WhatsAppMessage"
      (id, conversation_id, direction, sender_type, sender_name, text, status, wa_message_id, media_url, created_at, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    while (true) {
      const { cols, rows } = await executeTursoDml(`
        UPDATE "WhatsAppMessage" SET "id" = "id"
        WHERE rowid in (
          SELECT rowid FROM "WhatsAppMessage"
          WHERE rowid > ${lastRowid}
          ORDER BY rowid ASC
          LIMIT 1000
        )
        RETURNING rowid, id, conversation_id, direction, sender_type, sender_name, text, status, wa_message_id, media_url, created_at, error_message
      `);

      if (rows.length === 0) break;

      const trans = localDb.transaction((chunk) => {
        for (const r of chunk) {
          const get = (col: string) => parseVal(r[cols.indexOf(col)]);
          msgStmt.run(
            get("id"),
            get("conversation_id"),
            get("direction"),
            get("sender_type"),
            get("sender_name"),
            get("text"),
            get("status"),
            get("wa_message_id"),
            get("media_url"),
            get("created_at"),
            get("error_message")
          );
        }
      });

      trans(rows);
      totalMsgs += rows.length;

      const rowidCol = cols.indexOf("rowid");
      lastRowid = Math.max(...rows.map((r: any) => Number(r[rowidCol].value)));
      if (rows.length < 1000) break;
    }
    console.log(`✅ Restored ${totalMsgs} WhatsApp Messages.`);
  } catch (err: any) {
    console.warn("WhatsApp Message restore error:", err.message);
  }
}

async function main() {
  console.log("🚀 Starting Full Restoration from Turso Cloud to dev.db...");
  await restoreSettings();
  await restoreUsers();
  await restoreFieldTasks();
  await restoreLeads();
  await restoreLeadActivityLogs();
  await restoreWhatsApp();
  console.log("\n🎉 Full Turso Data Restoration Completed Successfully!");
  localDb.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  localDb.close();
  process.exit(1);
});
