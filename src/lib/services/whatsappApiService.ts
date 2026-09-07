import { prisma } from "@/lib/prisma";
import {
  normalizeWhatsAppPhone,
  formatDisplayPhone,
  GOCAB_WHATSAPP_TEMPLATES,
} from "@/lib/whatsapp";

export { normalizeWhatsAppPhone, formatDisplayPhone, GOCAB_WHATSAPP_TEMPLATES };

export const getDbConv = () =>
  (prisma as any).whatsAppConversation || (prisma as any).whatsappConversation;

export const getDbMsg = () =>
  (prisma as any).whatsAppMessage || (prisma as any).whatsappMessage;

export interface SendMessageOptions {
  conversationId?: string;
  phoneNumber: string;
  text: string;
  senderName?: string;
  templateKey?: string;
}

export interface InboundMessagePayload {
  fromPhone: string;
  contactName?: string;
  text: string;
  waMessageId?: string;
  mediaUrl?: string;
}

/**
 * Retrieves WhatsApp Cloud API settings from database Setting table or environment
 */
export async function getWhatsAppApiConfig() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "whatsapp_phone_number_id",
          "whatsapp_access_token",
          "whatsapp_verify_token",
          "whatsapp_waba_id",
        ],
      },
    },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  return {
    phoneNumberId: map.get("whatsapp_phone_number_id") || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: map.get("whatsapp_access_token") || process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: map.get("whatsapp_verify_token") || process.env.WHATSAPP_VERIFY_TOKEN || "gocab_whatsapp_crm_token_2026",
    wabaId: map.get("whatsapp_waba_id") || process.env.WHATSAPP_WABA_ID || "",
    isLiveConfigured: Boolean(
      (map.get("whatsapp_phone_number_id") || process.env.WHATSAPP_PHONE_NUMBER_ID) &&
      (map.get("whatsapp_access_token") || process.env.WHATSAPP_ACCESS_TOKEN)
    ),
  };
}

let tablesEnsured = false;

/**
 * Ensures WhatsAppConversation and WhatsAppMessage tables and indexes exist in the database.
 * Automatically runs DDL on first access to prevent SQLITE_UNKNOWN / no such table errors.
 */
export async function ensureWhatsAppTables(): Promise<void> {
  if (tablesEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WhatsAppConversation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "phone_number" TEXT NOT NULL,
        "contact_name" TEXT NOT NULL,
        "contact_type" TEXT NOT NULL DEFAULT 'UNKNOWN',
        "driver_id" TEXT,
        "lead_id" TEXT,
        "unread_count" INTEGER NOT NULL DEFAULT 0,
        "last_message" TEXT,
        "last_message_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "is_pinned" BOOLEAN NOT NULL DEFAULT 0,
        "is_archived" BOOLEAN NOT NULL DEFAULT 0,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConversation_phone_number_key" 
      ON "WhatsAppConversation"("phone_number")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WhatsAppConversation_last_message_at_idx" 
      ON "WhatsAppConversation"("last_message_at")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WhatsAppConversation_contact_type_idx" 
      ON "WhatsAppConversation"("contact_type")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "conversation_id" TEXT NOT NULL,
        "direction" TEXT NOT NULL,
        "sender_type" TEXT NOT NULL DEFAULT 'AGENT',
        "sender_name" TEXT,
        "text" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'SENT',
        "wa_message_id" TEXT,
        "media_url" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WhatsAppMessage_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "WhatsAppConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WhatsAppMessage_conversation_id_created_at_idx" 
      ON "WhatsAppMessage"("conversation_id", "created_at")
    `);

    tablesEnsured = true;
  } catch (err: any) {
    console.error("Auto-creating WhatsApp tables warning:", err?.message);
  }
}

/**
 * Finds or creates a WhatsApp conversation, auto-linking to GoCab Drivers or Leads
 */
export async function findOrCreateConversation(phoneNumber: string, contactName?: string) {
  const cleanPhone = normalizeWhatsAppPhone(phoneNumber);
  if (!cleanPhone) throw new Error("Numéro de téléphone invalide");

  await ensureWhatsAppTables();

  let conversation: any = null;
  try {
    conversation = await getDbConv().findUnique({
      where: { phone_number: cleanPhone },
    });
  } catch (err: any) {
    if (err?.message?.includes("no such table")) {
      tablesEnsured = false;
      await ensureWhatsAppTables();
      conversation = await getDbConv().findUnique({
        where: { phone_number: cleanPhone },
      });
    } else {
      throw err;
    }
  }

  if (conversation) {
    return conversation;
  }

  // Look up driver profile
  const drivers = await prisma.driverProfile.findMany({
    include: { assignedVehicle: true },
  }).catch(() => []);
  const matchedDriver = drivers.find((d: any) => {
    const dNorm = normalizeWhatsAppPhone(d.phoneSanitized);
    return dNorm === cleanPhone || dNorm.slice(-9) === cleanPhone.slice(-9);
  });

  // Look up lead
  let matchedLead: any = null;
  if (!matchedDriver) {
    const leads = await prisma.lead.findMany({
      where: { is_archived: false },
    }).catch(() => []);
    matchedLead = leads.find((l: any) => {
      const lNorm = normalizeWhatsAppPhone(l.sanitized_phone);
      return lNorm === cleanPhone || lNorm.slice(-9) === cleanPhone.slice(-9);
    });
  }

  const finalName =
    contactName ||
    matchedDriver?.fullName ||
    matchedLead?.raw_name ||
    `Contact +${cleanPhone}`;

  const contactType = matchedDriver ? "DRIVER" : matchedLead ? "LEAD" : "UNKNOWN";

  try {
    conversation = await getDbConv().create({
      data: {
        phone_number: cleanPhone,
        contact_name: finalName,
        driver_id: matchedDriver ? matchedDriver.id : null,
        lead_id: matchedLead ? matchedLead.id : null,
        contact_type: contactType,
        unread_count: 0,
        last_message: "Conversation initiée",
        last_message_at: new Date(),
        is_archived: false,
        is_pinned: false,
      },
    });
  } catch (err: any) {
    if (err?.message?.includes("no such table")) {
      tablesEnsured = false;
      await ensureWhatsAppTables();
      conversation = await getDbConv().create({
        data: {
          phone_number: cleanPhone,
          contact_name: finalName,
          driver_id: matchedDriver ? matchedDriver.id : null,
          lead_id: matchedLead ? matchedLead.id : null,
          contact_type: contactType,
          unread_count: 0,
          last_message: "Conversation initiée",
          last_message_at: new Date(),
          is_archived: false,
          is_pinned: false,
        },
      });
    } else {
      throw err;
    }
  }

  return conversation;
}

/**
 * Sends an outbound WhatsApp message via Meta Cloud API (if configured) and logs to DB
 */
export async function sendOutboundWhatsAppMessage(opts: SendMessageOptions) {
  await ensureWhatsAppTables();
  const cleanPhone = normalizeWhatsAppPhone(opts.phoneNumber);
  if (!cleanPhone) throw new Error("Numéro de téléphone invalide");

  const conversation =
    opts.conversationId
      ? await getDbConv().findUnique({ where: { id: opts.conversationId } })
      : await findOrCreateConversation(cleanPhone);

  if (!conversation) throw new Error("Conversation introuvable");

  const config = await getWhatsAppApiConfig();
  let waMessageId: string | null = null;
  let status = "SENT";
  let apiError: string | null = null;

  // If Meta WhatsApp Cloud API credentials are provided, call Meta Graph API
  if (config.isLiveConfigured) {
    try {
      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone,
            type: "text",
            text: { preview_url: false, body: opts.text },
          }),
        }
      );

      const metaData = await metaRes.json();
      if (metaRes.ok && metaData.messages && metaData.messages[0]) {
        waMessageId = metaData.messages[0].id;
        status = "SENT";
      } else {
        console.warn("WhatsApp Cloud API warning response:", metaData);
        apiError = metaData?.error?.message || "Erreur Meta Cloud API";
        status = "FAILED";
      }
    } catch (err: any) {
      console.error("WhatsApp Cloud API network error:", err);
      apiError = err.message;
      status = "FAILED";
    }
  }

  // Create message record in database
  const message = await getDbMsg().create({
    data: {
      conversation_id: conversation.id,
      direction: "OUTBOUND",
      sender_type: "AGENT",
      sender_name: opts.senderName || "GoCab Operations",
      text: opts.text,
      status: status,
      wa_message_id: waMessageId || `local-${Date.now()}`,
    },
  });

  // Update conversation's last message
  await getDbConv().update({
    where: { id: conversation.id },
    data: {
      last_message: opts.text,
      last_message_at: new Date(),
    },
  });

  return {
    success: status !== "FAILED",
    message,
    apiError,
    mode: config.isLiveConfigured ? "META_CLOUD_API" : "CRM_LIVE_SIMULATION",
  };
}

/**
 * Handles incoming WhatsApp message (from Webhook or Simulator)
 */
export async function handleInboundWhatsAppMessage(payload: InboundMessagePayload) {
  const cleanPhone = normalizeWhatsAppPhone(payload.fromPhone);
  if (!cleanPhone) throw new Error("Numéro de téléphone expéditeur invalide");

  const conversation = await findOrCreateConversation(cleanPhone, payload.contactName);

  const message = await getDbMsg().create({
    data: {
      conversation_id: conversation.id,
      direction: "INBOUND",
      sender_type: "CONTACT",
      sender_name: payload.contactName || conversation.contact_name,
      text: payload.text,
      status: "DELIVERED",
      wa_message_id: payload.waMessageId || `inbound-${Date.now()}`,
      media_url: payload.mediaUrl || null,
    },
  });

  await getDbConv().update({
    where: { id: conversation.id },
    data: {
      last_message: payload.text,
      last_message_at: new Date(),
      unread_count: { increment: 1 },
    },
  });

  return { success: true, message, conversationId: conversation.id };
}
