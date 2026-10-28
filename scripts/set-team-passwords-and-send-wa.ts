import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

const TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io/v2/pipeline";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";
const D360_API_KEY = "GWXTBL4vQP6MHGigqMIYYQkYAK";
const D360_URL = "https://waba-v2.360dialog.io/messages";
const PORTAL_URL = "https://gocab-iota.vercel.app";
const DEFAULT_PASSWORD = "GoCab2024!";

const db = new Database(path.join(process.cwd(), "dev.db"));

interface TeamMemberDef {
  name: string;
  email: string;
  phoneRaw: string;
  phoneSanitized: string;
  roleDescription: string;
}

const MEMBERS: TeamMemberDef[] = [
  {
    name: "Ayoub Gsaib",
    email: "ayoub.gsaib@gocab.io",
    phoneRaw: "+212 662-578066",
    phoneSanitized: "212662578066",
    roleDescription: "Pôle Formation, Précommandes & Affectation (Onboarding Specialist)",
  },
  {
    name: "Kaoutar Ouardi",
    email: "kaoutar.ouardi@gocab.io",
    phoneRaw: "+212 785-484701",
    phoneSanitized: "212785484701",
    roleDescription: "Pôle Acquisition & Prospection (Lead Acquisition Jr)",
  },
  {
    name: "Salma Abouri",
    email: "salma.abouri@gocab.io",
    phoneRaw: "+212 662-154721",
    phoneSanitized: "212662154721",
    roleDescription: "Pôle Performance Flotte, Recouvrement & Rétention (Fleet Manager)",
  },
  {
    name: "Ayoub Rassid",
    email: "ayoub.rassid@gocab.io",
    phoneRaw: "+212 662-149266",
    phoneSanitized: "212662149266",
    roleDescription: "Pôle Opérations Terrain & Support Technique (Field Supervisor)",
  },
  {
    name: "Nour Abouri",
    email: "nour.abouri@gocab.io",
    phoneRaw: "+212 666-318446",
    phoneSanitized: "212666318446",
    roleDescription: "Pôle Acquisition & Téléprospection (Brand Manager)",
  },
  {
    name: "Mohamed Aziz",
    email: "mohamed.aziz@gocab.io",
    phoneRaw: "+212 666-563066",
    phoneSanitized: "212666563066",
    roleDescription: "Pôle Flotte & Recouvrement 75 Véhicules (Fleet Perf Manager)",
  },
  {
    name: "Mehdi Elyattouti",
    email: "mehdi.elyattouti@gocab.io",
    phoneRaw: "+212 667-960025",
    phoneSanitized: "212667960025",
    roleDescription: "Pôle Flotte Dédié 26 Véhicules (Fleet Perf Manager)",
  },
  {
    name: "Hamza Rassid",
    email: "hamza.rassid@gocab.io",
    phoneRaw: "+212 693-112061",
    phoneSanitized: "212693112061",
    roleDescription: "Pôle Opérations Terrain & Missions (Field Supervisor)",
  },
];

async function updatePasswordInDbAndTurso(email: string, passwordHash: string) {
  // Update local dev.db
  db.prepare('UPDATE "User" SET passwordHash = ?, isActive = 1 WHERE email = ?').run(passwordHash, email);

  // Update Turso Cloud
  try {
    await fetch(TURSO_URL, {
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
              sql: `UPDATE "User" SET passwordHash = '${passwordHash}', isActive = 1 WHERE email = '${email}'`,
            },
          },
        ],
      }),
    });
  } catch (e: any) {
    console.warn(`Could not sync password for ${email} to Turso:`, e.message);
  }
}

async function sendWhatsAppMessage(member: TeamMemberDef) {
  const messageBody = 
`Bonjour ${member.name},

Voici vos identifiants d'accès officiels à la plateforme GoCab CRM :

🌐 Lien d'accès : ${PORTAL_URL}
📧 Identifiant (Email) : ${member.email}
🔑 Mot de passe : ${DEFAULT_PASSWORD}

📌 Rôle & Pôle : ${member.roleDescription}

Connectez-vous dès maintenant pour accéder à vos tableaux de bord et outils opérationnels.

L'équipe GoCab Morocco.`;

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

async function logWhatsAppToDb(member: TeamMemberDef, waMessageId: string | null) {
  const now = new Date().toISOString();
  const convId = `conv-team-${member.phoneSanitized}`;

  // Find or create conversation
  db.prepare(`
    INSERT OR REPLACE INTO "WhatsAppConversation"
    (id, phone_number, contact_name, contact_type, last_message, last_message_at, unread_count, is_pinned, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, 'TEAM', ?, ?, 0, 1, 0, ?, ?)
  `).run(
    convId,
    `+${member.phoneSanitized}`,
    member.name,
    `Identifiants d'accès GoCab CRM envoyés (Email: ${member.email})`,
    now,
    now,
    now
  );

  // Log message
  db.prepare(`
    INSERT OR REPLACE INTO "WhatsAppMessage"
    (id, conversation_id, direction, sender_type, sender_name, text, status, wa_message_id, created_at)
    VALUES (?, ?, 'OUTBOUND', 'SYSTEM', 'GoCab Admin', ?, 'DELIVERED', ?, ?)
  `).run(
    `msg-team-${member.phoneSanitized}-${Date.now()}`,
    convId,
    `Identifiants d'accès GoCab CRM envoyés :\nEmail : ${member.email}\nMot de passe : ${DEFAULT_PASSWORD}\nLien : ${PORTAL_URL}`,
    waMessageId,
    now
  );
}

async function main() {
  console.log("==========================================================");
  console.log("🚀 Sending GoCab CRM Access Credentials via WhatsApp 360dialog");
  console.log("==========================================================\n");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  console.log(`🔐 Generated standard bcrypt hash for password: "${DEFAULT_PASSWORD}"\n`);

  const results: any[] = [];

  for (const member of MEMBERS) {
    console.log(`📡 Processing: ${member.name} (${member.phoneRaw} / ${member.email})...`);

    // 1. Ensure password hash matches in DB & Turso
    await updatePasswordInDbAndTurso(member.email, passwordHash);

    // 2. Send live WhatsApp message via 360dialog API
    const sendResult = await sendWhatsAppMessage(member);

    // 3. Log to CRM WhatsApp archive
    if (sendResult.ok) {
      await logWhatsAppToDb(member, sendResult.waMessageId);
      console.log(`   ✅ Envoyé avec succès ! (WAMID: ${sendResult.waMessageId})`);
    } else {
      console.error(`   ❌ Échec d'envoi (${sendResult.status}):`, JSON.stringify(sendResult.error));
    }

    results.push({
      member: member.name,
      phone: member.phoneRaw,
      email: member.email,
      status: sendResult.ok ? "ENVOYÉ (200 OK)" : `ERREUR (${sendResult.status})`,
      wamid: sendResult.waMessageId,
    });

    // Small delay to ensure clean dispatching
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log("\n==========================================================");
  console.log("📊 Récapitulatif des Envois WhatsApp 360dialog :");
  console.log("==========================================================");
  console.table(results);

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
}

main().catch(console.error);
