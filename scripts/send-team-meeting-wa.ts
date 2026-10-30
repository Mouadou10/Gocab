import Database from "better-sqlite3";
import path from "path";

const D360_API_KEY = "GWXTBL4vQP6MHGigqMIYYQkYAK";
const D360_URL = "https://waba-v2.360dialog.io/messages";

const db = new Database(path.join(process.cwd(), "dev.db"));

interface TeamMemberDef {
  name: string;
  firstName: string;
  email: string;
  phoneRaw: string;
  phoneSanitized: string;
  roleDescription: string;
}

const MEMBERS: TeamMemberDef[] = [
  {
    name: "Ayoub Gsaib",
    firstName: "Ayoub",
    email: "ayoub.gsaib@gocab.io",
    phoneRaw: "+212 662-578066",
    phoneSanitized: "212662578066",
    roleDescription: "Pôle Formation, Précommandes & Affectation",
  },
  {
    name: "Kaoutar Ouardi",
    firstName: "Kaoutar",
    email: "kaoutar.ouardi@gocab.io",
    phoneRaw: "+212 785-484701",
    phoneSanitized: "212785484701",
    roleDescription: "Pôle Acquisition & Prospection",
  },
  {
    name: "Salma Abouri",
    firstName: "Salma",
    email: "salma.abouri@gocab.io",
    phoneRaw: "+212 662-154721",
    phoneSanitized: "212662154721",
    roleDescription: "Pôle Performance Flotte, Recouvrement & Rétention",
  },
  {
    name: "Ayoub Rassid",
    firstName: "Ayoub",
    email: "ayoub.rassid@gocab.io",
    phoneRaw: "+212 662-149266",
    phoneSanitized: "212662149266",
    roleDescription: "Pôle Opérations Terrain & Support Technique",
  },
  {
    name: "Nour Abouri",
    firstName: "Nour",
    email: "nour.abouri@gocab.io",
    phoneRaw: "+212 666-318446",
    phoneSanitized: "212666318446",
    roleDescription: "Pôle Acquisition & Téléprospection",
  },
  {
    name: "Mohamed Aziz",
    firstName: "Mohamed",
    email: "mohamed.aziz@gocab.io",
    phoneRaw: "+212 666-563066",
    phoneSanitized: "212666563066",
    roleDescription: "Pôle Flotte & Recouvrement",
  },
  {
    name: "Mehdi Elyattouti",
    firstName: "Mehdi",
    email: "mehdi.elyattouti@gocab.io",
    phoneRaw: "+212 667-960025",
    phoneSanitized: "212667960025",
    roleDescription: "Pôle Flotte Dédié",
  },
  {
    name: "Hamza Rassid",
    firstName: "Hamza",
    email: "hamza.rassid@gocab.io",
    phoneRaw: "+212 693-112061",
    phoneSanitized: "212693112061",
    roleDescription: "Pôle Opérations Terrain & Missions",
  },
];

function buildMeetingMessage(member: TeamMemberDef): string {
  return `Bonjour ${member.firstName},

📢 *Annonce Équipe GoCab - Organisation des Réunions :*

1️⃣ *Réunion Globale d'Équipe :*
Nous aurons désormais une réunion globale avec l'ensemble des départements chaque lundi à 18h00 (6:00 PM).

2️⃣ *Réunions Individuelles par Département :*
Un point individuel dédié est également prévu pour chaque département selon le planning opérationnel.

📅 Merci de consulter votre calendrier sur le CRM GoCab afin de prendre connaissance des détails, ordres du jour et de vos créneaux spécifiques.

Bonne continuation et excellent travail à tous !
_Direction GoCab Operations_`;
}

async function sendWhatsAppMessage(member: TeamMemberDef, messageBody: string) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: member.phoneSanitized,
    type: "text",
    text: { body: messageBody },
  };

  const res = await fetch(D360_URL, {
    method: "POST",
    headers: {
      "D360-API-KEY": D360_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  const waMessageId = body?.messages?.[0]?.id || null;

  return {
    status: res.status,
    ok: res.ok,
    waMessageId,
    error: body?.error || null,
  };
}

function logWhatsAppToDb(member: TeamMemberDef, messageBody: string, waMessageId: string | null) {
  const now = new Date().toISOString();
  const convId = `conv-team-${member.phoneSanitized}`;
  const lastMessageSnippet = `📢 Réunions : Globale chaque lundi à 18h00 + point individuel par pôle (voir calendrier)`;

  // Update or insert conversation
  db.prepare(`
    INSERT INTO "WhatsAppConversation"
    (id, phone_number, contact_name, contact_type, last_message, last_message_at, unread_count, is_pinned, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, 'TEAM', ?, ?, 0, 0, 0, ?, ?)
    ON CONFLICT(phone_number) DO UPDATE SET
      contact_name = excluded.contact_name,
      contact_type = 'TEAM',
      last_message = excluded.last_message,
      last_message_at = excluded.last_message_at,
      updated_at = excluded.updated_at
  `).run(
    convId,
    `+${member.phoneSanitized}`,
    member.name,
    lastMessageSnippet,
    now,
    now,
    now
  );

  // Insert message into WhatsAppMessage
  const msgId = `msg-team-meet-${member.phoneSanitized}-${Date.now()}`;
  db.prepare(`
    INSERT INTO "WhatsAppMessage"
    (id, conversation_id, direction, sender_type, sender_name, text, status, wa_message_id, created_at)
    VALUES (?, ?, 'OUTBOUND', 'AGENT', 'Mouad Koudia', ?, 'DELIVERED', ?, ?)
  `).run(
    msgId,
    convId,
    messageBody,
    waMessageId,
    now
  );
}

async function main() {
  console.log("==================================================================");
  console.log("🚀 Envoi de l'annonce Réunions Hebdomadaires à toute l'équipe GoCab");
  console.log("==================================================================\n");

  const results: any[] = [];

  for (const member of MEMBERS) {
    const messageBody = buildMeetingMessage(member);
    console.log(`📡 Envoi à : ${member.name} (${member.phoneRaw})...`);

    const sendResult = await sendWhatsAppMessage(member, messageBody);

    logWhatsAppToDb(member, messageBody, sendResult.waMessageId);

    if (sendResult.ok) {
      console.log(`   ✅ Envoyé avec succès ! (WAMID: ${sendResult.waMessageId})`);
    } else {
      console.error(`   ⚠️ Erreur 360dialog (${sendResult.status}):`, JSON.stringify(sendResult.error));
    }

    results.push({
      member: member.name,
      phone: member.phoneRaw,
      role: member.roleDescription,
      status: sendResult.ok ? "ENVOYÉ (200 OK)" : `API (${sendResult.status})`,
      wamid: sendResult.waMessageId || "enregistré en DB",
    });

    await new Promise((r) => setTimeout(r, 600));
  }

  console.log("\n==================================================================");
  console.log("📊 Bilan d'envoi WhatsApp CRM à l'équipe :");
  console.log("==================================================================");
  console.table(results);

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
}

main().catch(console.error);
