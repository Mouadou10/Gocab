import { prisma } from "../src/lib/prisma";
import { createClient } from "@libsql/client";

interface LeadRestoreData {
  id: string;
  name: string;
  phone: string;
  board_column: string;
  brand_status: string;
  training_status: string | null;
  reminder_date: string | null;
  handled_by: string;
  status_changed_at: string;
}

const LEADS_TO_RESTORE: LeadRestoreData[] = [
  {
    id: "c509bcb0-82ff-4908-8e8c-a844315b1d58",
    name: "Oussama",
    phone: "+212778828424",
    board_column: "BRAND_PRE_FILTER",
    brand_status: "Not interested",
    training_status: null,
    reminder_date: null,
    handled_by: "Kaoutar Ouardi",
    status_changed_at: "2026-11-04T10:40:49.503Z",
  },
  {
    id: "2540b318-e6e2-4e67-8c35-edf3e3c5175e",
    name: "Kaoutar Ojbara El Idrissi",
    phone: "+212613132679",
    board_column: "TRAINING_PIPELINE",
    brand_status: "Training fixed",
    training_status: "Scheduled",
    reminder_date: "2026-11-05T10:00:00.000Z",
    handled_by: "Kaoutar Ouardi",
    status_changed_at: "2026-11-04T10:47:58.082Z",
  },
  {
    id: "a9f0d7ad-fc94-4e6b-9e62-3abb47a1b40e",
    name: "Hakim oulaid",
    phone: "+212642953728",
    board_column: "BRAND_PRE_FILTER",
    brand_status: "No response 1",
    training_status: null,
    reminder_date: null,
    handled_by: "Kaoutar Ouardi",
    status_changed_at: "2026-11-04T10:50:53.354Z",
  },
  {
    id: "d2470fb0-d6fa-4d26-a33c-c7b71baa92f2",
    name: "Soufyan Zaitani",
    phone: "+212634434309",
    board_column: "TRAINING_PIPELINE",
    brand_status: "Training fixed",
    training_status: "Scheduled",
    reminder_date: "2026-11-05T10:00:00.000Z",
    handled_by: "Kaoutar Ouardi",
    status_changed_at: "2026-11-04T10:53:58.207Z",
  },
  {
    id: "b62e7a67-7141-4682-a4a1-cbc0c8182121",
    name: "ilyas dourass",
    phone: "+212714489008",
    board_column: "TRAINING_PIPELINE",
    brand_status: "Training fixed",
    training_status: "Scheduled",
    reminder_date: "2026-11-04T12:00:00.000Z",
    handled_by: "Kaoutar Ouardi",
    status_changed_at: "2026-11-04T10:57:07.871Z",
  },
  {
    id: "e4ff0bb3-1d10-43fc-904a-6124b1a37c6c",
    name: "kaoutarelmanssouri Tahdi",
    phone: "+212661418262",
    board_column: "BRAND_PRE_FILTER",
    brand_status: "Not interested",
    training_status: null,
    reminder_date: null,
    handled_by: "Kaoutar Ouardi",
    status_changed_at: "2026-11-04T11:06:54.899Z",
  },
  {
    id: "6f4ed29e-2bc9-4a44-8814-18dd5b86a8d4",
    name: "Abdellah Merouàne",
    phone: "+212772879521",
    board_column: "BRAND_PRE_FILTER",
    brand_status: "Not interested",
    training_status: null,
    reminder_date: null,
    handled_by: "Kaoutar Ouardi",
    status_changed_at: "2026-11-04T11:10:20.664Z",
  },
];

async function main() {
  console.log("==================================================");
  console.log("🔄 Restoring Today's 7 Leads (04/11/2026)");
  console.log("==================================================");

  // 1. Update Local SQLite Database
  for (const item of LEADS_TO_RESTORE) {
    await prisma.lead.update({
      where: { id: item.id },
      data: {
        board_column: item.board_column,
        brand_status: item.brand_status,
        training_status: item.training_status,
        reminder_date: item.reminder_date ? new Date(item.reminder_date) : null,
        handled_by: item.handled_by,
        status_changed_at: new Date(item.status_changed_at),
        updated_at: new Date(item.status_changed_at),
      },
    }).catch(async () => {
      await prisma.lead.create({
        data: {
          id: item.id,
          raw_name: item.name,
          sanitized_phone: item.phone,
          campaign_source: "Manual Intake",
          board_column: item.board_column,
          brand_status: item.brand_status,
          training_status: item.training_status,
          reminder_date: item.reminder_date ? new Date(item.reminder_date) : null,
          handled_by: item.handled_by,
          status_changed_at: new Date(item.status_changed_at),
          updated_at: new Date(item.status_changed_at),
        },
      });
    });

    // Ensure CALL_INITIATED log exists for each
    const existingCallLog = await prisma.leadActivityLog.findFirst({
      where: {
        lead_id: item.id,
        action: "CALL_INITIATED",
        created_at: {
          gte: new Date("2026-11-04T00:00:00.000Z"),
          lt: new Date("2026-11-05T00:00:00.000Z"),
        },
      },
    });

    if (!existingCallLog) {
      await prisma.leadActivityLog.create({
        data: {
          lead_id: item.id,
          agent: item.handled_by,
          action: "CALL_INITIATED",
          detail: "Appel effectué / prospect rappelé (+1 Appel Comptabilisé)",
          created_at: new Date(item.status_changed_at),
        },
      });
    }

    console.log(`✅ Local: Restored ${item.name} (${item.brand_status})`);
  }

  // 2. Clean up test-id if present
  await prisma.lead.delete({ where: { id: "test-id" } }).catch(() => {});

  // 3. Update Remote Turso Scaler Database
  const tursoUrl = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io";
  const tursoToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM3NDY2NTUsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.ogUW1p4VQevvjHu2lhpNwtQE4EqelyYSt3tFanuC5tpFdUJEc-m_4YyRb97SzKhVQ6VwkpVj7x2Or61eJig7BQ";

  const client = createClient({ url: tursoUrl, authToken: tursoToken });

  for (const item of LEADS_TO_RESTORE) {
    await client.execute({
      sql: `UPDATE Lead SET 
            board_column = ?, 
            brand_status = ?, 
            training_status = ?, 
            reminder_date = ?, 
            handled_by = ?, 
            status_changed_at = ?,
            updated_at = ?
            WHERE id = ?`,
      args: [
        item.board_column,
        item.brand_status,
        item.training_status,
        item.reminder_date,
        item.handled_by,
        item.status_changed_at,
        item.status_changed_at,
        item.id,
      ],
    });

    // Check call log on remote
    const callLogRs = await client.execute({
      sql: "SELECT id FROM LeadActivityLog WHERE lead_id = ? AND action = 'CALL_INITIATED' AND created_at LIKE '2026-11-04%'",
      args: [item.id],
    });

    if (callLogRs.rows.length === 0) {
      await client.execute({
        sql: `INSERT INTO LeadActivityLog (id, lead_id, agent, action, detail, created_at)
              VALUES (?, ?, ?, 'CALL_INITIATED', 'Appel effectué / prospect rappelé (+1 Appel Comptabilisé)', ?)`,
        args: [
          `call-log-${item.id}-${Date.now()}`,
          item.id,
          item.handled_by,
          item.status_changed_at,
        ],
      });
    }

    console.log(`✅ Remote Turso: Restored ${item.name} (${item.brand_status})`);
  }

  // Clean up test-id on remote
  await client.execute({
    sql: "DELETE FROM Lead WHERE id = 'test-id'",
    args: [],
  }).catch(() => {});
  await client.execute({
    sql: "DELETE FROM LeadActivityLog WHERE lead_id = 'test-id'",
    args: [],
  }).catch(() => {});

  // 4. Touch sync state on both
  const nowMs = Date.now();
  const syncStateJson = JSON.stringify({
    leads: nowMs,
    version: String(nowMs),
    forceRefreshAt: nowMs,
    updatedAt: nowMs,
  });

  await prisma.setting.upsert({
    where: { key: "data_sync_state" },
    create: { key: "data_sync_state", value: syncStateJson },
    update: { value: syncStateJson },
  });

  await client.execute({
    sql: "INSERT INTO Setting (key, value) VALUES ('data_sync_state', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [syncStateJson],
  });

  console.log("\n==================================================");
  console.log("📊 Final Verification for Today (04/11/2026):");

  const remoteToday = await client.execute({
    sql: "SELECT id, raw_name, sanitized_phone, board_column, brand_status, handled_by, status_changed_at, reminder_date FROM Lead WHERE status_changed_at LIKE '2026-11-04%'",
    args: [],
  });

  console.log(`Total Leads on 04/11/2026: ${remoteToday.rows.length}`);
  console.table(remoteToday.rows);

  const remoteCalls = await client.execute({
    sql: "SELECT count(DISTINCT lead_id) as total_called FROM LeadActivityLog WHERE created_at LIKE '2026-11-04%' AND action = 'CALL_INITIATED'",
    args: [],
  });
  console.log(`Total Distinct Called Leads Today: ${remoteCalls.rows[0].total_called}`);
  console.log("==================================================");
}

main().catch(console.error);
