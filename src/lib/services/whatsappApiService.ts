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
 * Supports official 360dialog WhatsApp Business Cloud API and Meta Cloud API.
 */
export async function getWhatsAppApiConfig() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "whatsapp_provider",
          "whatsapp_360dialog_api_key",
          "whatsapp_360dialog_api_url",
          "whatsapp_phone_number",
          "whatsapp_channel_id",
          "whatsapp_phone_number_id",
          "whatsapp_access_token",
          "whatsapp_verify_token",
          "whatsapp_waba_id",
        ],
      },
    },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  const rawD360Key =
    map.get("whatsapp_360dialog_api_key") ||
    process.env.WHATSAPP_360DIALOG_API_KEY ||
    "";

  // If the key is the old placeholder "cAT0snZ5THgwe9XWha04qQUPAK", it is not a valid 360dialog key
  const isMockKey = rawD360Key === "cAT0snZ5THgwe9XWha04qQUPAK" || rawD360Key.length < 10;
  const d360ApiKey = isMockKey ? "" : rawD360Key;

  const d360ApiUrl =
    map.get("whatsapp_360dialog_api_url") ||
    process.env.WHATSAPP_360DIALOG_API_URL ||
    "https://waba-v2.360dialog.io";

  const phoneNumber =
    map.get("whatsapp_phone_number") ||
    process.env.WHATSAPP_PHONE_NUMBER ||
    "+212662145109";

  const channelId =
    map.get("whatsapp_channel_id") ||
    process.env.WHATSAPP_CHANNEL_ID ||
    "1317636061430129";

  const phoneNumberId =
    map.get("whatsapp_phone_number_id") ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    "";

  const accessToken =
    map.get("whatsapp_access_token") ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    "";

  const verifyToken =
    map.get("whatsapp_verify_token") ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    "gocab_whatsapp_crm_token_2026";

  const wabaId =
    map.get("whatsapp_waba_id") ||
    process.env.WHATSAPP_WABA_ID ||
    "2092399898064944";

  const provider =
    map.get("whatsapp_provider") ||
    (d360ApiKey ? "360dialog" : accessToken ? "meta" : "360dialog");

  const isLiveConfigured = Boolean(
    (provider === "360dialog" && d360ApiKey) ||
    (provider === "meta" && phoneNumberId && accessToken)
  );

  return {
    provider,
    d360ApiKey,
    isMockKey,
    d360ApiUrl,
    phoneNumber,
    channelId,
    phoneNumberId,
    accessToken,
    verifyToken,
    wabaId,
    isLiveConfigured,
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
        "error_message" TEXT,
        "media_url" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WhatsAppMessage_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "WhatsAppConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "WhatsAppMessage" ADD COLUMN "error_message" TEXT`);
    } catch (_) {}

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

  // Fast targeted lookup for driver profile
  const shortPhone = cleanPhone.slice(-9);
  const matchedDriver = await prisma.driverProfile.findFirst({
    where: {
      phoneSanitized: { contains: shortPhone },
    },
    select: { id: true, fullName: true },
  }).catch(() => null);

  // Fast targeted lookup for lead
  let matchedLead: any = null;
  if (!matchedDriver) {
    matchedLead = await prisma.lead.findFirst({
      where: {
        sanitized_phone: { contains: shortPhone },
        is_archived: false,
      },
      select: { id: true, raw_name: true },
    }).catch(() => null);
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
  let deliveryMode = "CRM_LIVE_SIMULATION";

  // Dispatch live WhatsApp Business API message
  if (config.isLiveConfigured) {
    if (config.provider === "360dialog" && config.d360ApiKey) {
      try {
        const d360Base = config.d360ApiUrl.replace(/\/$/, "");
        // 360dialog Messaging API Endpoint
        const d360Res = await fetch(`${d360Base}/messages`, {
          method: "POST",
          headers: {
            "D360-API-KEY": config.d360ApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone,
            type: "text",
            text: { body: opts.text },
          }),
        });

        const d360Data = await d360Res.json().catch(() => null);

        if (d360Res.ok && d360Data?.messages && d360Data.messages[0]) {
          waMessageId = d360Data.messages[0].id;
          status = "SENT";
          deliveryMode = "360DIALOG_WABA";
        } else {
          console.warn("360dialog response:", d360Res.status, d360Data);
          if (d360Res.status === 401) {
            apiError =
              "Erreur 360dialog HTTP 401 (Non autorisé) : La clé API 360dialog est invalide ou non générée. Rendez-vous sur app.360dialog.com pour copier la clé API de votre canal et la coller dans Paramètres.";
          } else {
            apiError =
              d360Data?.meta?.developer_message ||
              d360Data?.error?.message ||
              d360Data?.detail ||
              d360Data?.message ||
              (d360Data?.errors && d360Data.errors[0]?.details) ||
              `Erreur 360dialog HTTP ${d360Res.status}`;
          }
          status = "FAILED";
          deliveryMode = "360DIALOG_WABA";
        }
      } catch (err: any) {
        console.error("360dialog network error:", err);
        apiError = err.message || "Erreur de connexion 360dialog";
        status = "FAILED";
        deliveryMode = "360DIALOG_WABA";
      }
    } else if (config.phoneNumberId && config.accessToken) {
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

        const metaData = await metaRes.json().catch(() => null);
        if (metaRes.ok && metaData?.messages && metaData.messages[0]) {
          waMessageId = metaData.messages[0].id;
          status = "SENT";
          deliveryMode = "META_GRAPH_API";
        } else {
          console.warn("Meta Cloud API warning response:", metaData);
          apiError = metaData?.error?.message || "Erreur Meta Cloud API";
          status = "FAILED";
          deliveryMode = "META_GRAPH_API";
        }
      } catch (err: any) {
        console.error("WhatsApp Cloud API network error:", err);
        apiError = err.message;
        status = "FAILED";
        deliveryMode = "META_GRAPH_API";
      }
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
      error_message: apiError || null,
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
    mode: deliveryMode,
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

/**
 * Add phone number to 360dialog allowlist (for testing / controlled launch before payment)
 */
export async function addPhoneTo360dialogAllowlist(phoneNumber: string) {
  const config = await getWhatsAppApiConfig();
  const formattedPhone = phoneNumber.startsWith("+")
    ? phoneNumber
    : `+${phoneNumber.replace(/^0/, "212")}`;

  if (!config.d360ApiKey) {
    return {
      success: true,
      localOnly: true,
      status: 200,
      response: { message: "Sauvegardé localement dans le CRM (en attente de votre clé API 360dialog)." },
      phoneNumber: formattedPhone,
    };
  }

  const d360Base = config.d360ApiUrl.replace(/\/$/, "");
  const res = await fetch(`${d360Base}/agent_config/allowlist`, {
    method: "POST",
    headers: {
      "D360-API-KEY": config.d360ApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone_number: formattedPhone }),
  });

  const data = await res.json().catch(() => null);
  return {
    success: res.ok,
    status: res.status,
    response: data,
    phoneNumber: formattedPhone,
  };
}

/**
 * Get current 360dialog allowlist and AI audience configuration
 */
export async function get360dialogAllowlist() {
  const config = await getWhatsAppApiConfig();
  if (!config.d360ApiKey) {
    return { allowlist: [], audience: "ALLOWLISTED_ONLY" };
  }

  const d360Base = config.d360ApiUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${d360Base}/agent_config/allowlist`, {
      headers: { "D360-API-KEY": config.d360ApiKey },
    });
    const data = await res.json().catch(() => null);

    let audience = "ALLOWLISTED_ONLY";
    try {
      const configRes = await fetch(`${d360Base}/agent_config`, {
        headers: { "D360-API-KEY": config.d360ApiKey },
      });
      const configData = await configRes.json().catch(() => null);
      if (configData?.ai_audience) {
        audience = configData.ai_audience;
      }
    } catch {}

    const list = Array.isArray(data)
      ? data
      : data?.phone_numbers || data?.allowlist || [];

    return {
      success: res.ok,
      allowlist: list,
      audience,
    };
  } catch (err: any) {
    return { success: false, error: err.message, allowlist: [], audience: "ALLOWLISTED_ONLY" };
  }
}

/**
 * Set 360dialog AI Audience (ALLOWLISTED_ONLY or EVERYONE)
 */
export async function set360dialogAudience(audience: "ALLOWLISTED_ONLY" | "EVERYONE") {
  const config = await getWhatsAppApiConfig();
  if (!config.d360ApiKey) {
    throw new Error("Clé API 360dialog non configurée");
  }

  const d360Base = config.d360ApiUrl.replace(/\/$/, "");
  const res = await fetch(`${d360Base}/agent_config`, {
    method: "POST",
    headers: {
      "D360-API-KEY": config.d360ApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ai_audience: audience }),
  });

  const data = await res.json().catch(() => null);
  return {
    success: res.ok,
    status: res.status,
    response: data,
    audience,
  };
}
