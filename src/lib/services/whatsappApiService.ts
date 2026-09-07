import { prisma } from "@/lib/prisma";
import {
  normalizeWhatsAppPhone,
  formatDisplayPhone,
  GOCAB_WHATSAPP_TEMPLATES,
} from "@/lib/whatsapp";

export { normalizeWhatsAppPhone, formatDisplayPhone, GOCAB_WHATSAPP_TEMPLATES };

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

/**
 * Finds or creates a WhatsApp conversation, auto-linking to GoCab Drivers or Leads
 */
export async function findOrCreateConversation(phoneNumber: string, contactName?: string) {
  const cleanPhone = normalizeWhatsAppPhone(phoneNumber);
  if (!cleanPhone) throw new Error("Numéro de téléphone invalide");

  let conversation = await prisma.whatsAppConversation.findUnique({
    where: { phone_number: cleanPhone },
  });

  if (conversation) {
    return conversation;
  }

  // Look up driver profile
  const drivers = await prisma.driverProfile.findMany({
    include: { assignedVehicle: true },
  });
  const matchedDriver = drivers.find((d) => {
    const dNorm = normalizeWhatsAppPhone(d.phoneSanitized);
    return dNorm === cleanPhone || dNorm.slice(-9) === cleanPhone.slice(-9);
  });

  // Look up lead
  let matchedLead: any = null;
  if (!matchedDriver) {
    const leads = await prisma.lead.findMany({
      where: { is_archived: false },
    });
    matchedLead = leads.find((l) => {
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

  conversation = await prisma.whatsAppConversation.create({
    data: {
      phone_number: cleanPhone,
      contact_name: finalName,
      driver_id: matchedDriver ? matchedDriver.id : null,
      lead_id: matchedLead ? matchedLead.id : null,
      contact_type: contactType,
      unread_count: 0,
      last_message: "Conversation initiée",
      last_message_at: new Date(),
    },
  });

  return conversation;
}

/**
 * Sends an outbound WhatsApp message via Meta Cloud API (if configured) and logs to DB
 */
export async function sendOutboundWhatsAppMessage(opts: SendMessageOptions) {
  const cleanPhone = normalizeWhatsAppPhone(opts.phoneNumber);
  if (!cleanPhone) throw new Error("Numéro de téléphone invalide");

  const conversation =
    opts.conversationId
      ? await prisma.whatsAppConversation.findUnique({ where: { id: opts.conversationId } })
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
  const message = await prisma.whatsAppMessage.create({
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
  await prisma.whatsAppConversation.update({
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

  const message = await prisma.whatsAppMessage.create({
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

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: {
      last_message: payload.text,
      last_message_at: new Date(),
      unread_count: { increment: 1 },
    },
  });

  return { success: true, message, conversationId: conversation.id };
}
