import Database from "better-sqlite3";
import path from "node:path";
import { createClient } from "@libsql/client";

const TURSO_URL = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set!");
  process.exit(1);
}

const localDb = new Database(path.join(process.cwd(), "dev.db"));
const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

async function main() {
  console.log("🔄 Syncing Zakaria conversation and messages from local SQLite to Turso Cloud...");

  // Find Zakaria conversation
  const conv: any = localDb
    .prepare("SELECT * FROM WhatsAppConversation WHERE phone_number LIKE '%601299117%'")
    .get();

  if (!conv) {
    console.error("Conversation not found locally!");
    return;
  }

  console.log("Found local conv:", conv.id, conv.contact_name);

  // Upsert to Turso Cloud
  await turso.execute({
    sql: `INSERT OR REPLACE INTO WhatsAppConversation (
      id, phone_number, contact_name, contact_type, workflow_state,
      routed_department, matched_plate, matched_vehicle_id, last_message,
      last_message_at, unread_count, is_pinned, is_archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      conv.id,
      conv.phone_number,
      "Zakaria (Apporteur)",
      "PARTNER",
      "ROUTED_LEAD_ACQUISITION",
      "LEAD_ACQUISITION",
      conv.matched_plate ?? null,
      conv.matched_vehicle_id ?? null,
      conv.last_message,
      conv.last_message_at,
      0,
      1, // is_pinned: true so it shows at the very top!
      0,
      conv.created_at,
      new Date().toISOString(),
    ],
  });
  console.log("✅ Synced WhatsAppConversation to Turso Cloud!");

  // Find messages
  const msgs: any[] = localDb
    .prepare("SELECT * FROM WhatsAppMessage WHERE conversation_id = ?")
    .all(conv.id);

  console.log(`Found ${msgs.length} messages for Zakaria locally`);

  for (const msg of msgs) {
    await turso.execute({
      sql: `INSERT OR REPLACE INTO WhatsAppMessage (
        id, conversation_id, direction, sender_type, sender_name,
        text, status, wa_message_id, error_message, media_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        msg.id,
        msg.conversation_id,
        msg.direction,
        msg.sender_type,
        msg.sender_name,
        msg.text,
        msg.status,
        msg.wa_message_id ?? null,
        msg.error_message ?? null,
        msg.media_url ?? null,
        msg.created_at,
      ],
    });
    console.log("✅ Synced message to Turso Cloud:", msg.id);
  }

  console.log("🎉 Complete! Zakaria conversation is now persisted in Turso Cloud.");
}

main().catch(console.error);
