import { prisma } from "@/lib/prisma";

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
 * Normalizes phone numbers to comparable digits-only format (e.g. 2126XXXXXXXX).
 */
export function normalizeWhatsAppPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  // Local Moroccan phone: 06... or 07... -> 2126... or 2127...
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "212" + digits.slice(1);
  } else if (digits.length === 9) {
    digits = "212" + digits;
  }
  return digits;
}

/**
 * Formats a clean phone for display (e.g. +212 6XX-XXXXXX)
 */
export function formatDisplayPhone(phone: string): string {
  const norm = normalizeWhatsAppPhone(phone);
  if (norm.startsWith("212") && norm.length >= 11) {
    return `+212 ${norm.slice(3, 5)} ${norm.slice(5, 8)}-${norm.slice(8)}`;
  }
  return phone.startsWith("+") ? phone : `+${norm}`;
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

/**
 * Standard GoCab CRM Quick Reply Templates
 */
export const GOCAB_WHATSAPP_TEMPLATES = [
  {
    id: "PAYMENT_DAILY_REMINDER",
    title: "💰 Rappel Versement Journalier (300 MAD)",
    category: "Recouvrement",
    text: "Bonjour {{name}},\n\nNous vous rappelons que votre versement journalier GoCab de 300 MAD est attendu aujourd'hui.\nSolde actuel : {{arrears}} MAD.\n\nMerci de procéder au règlement pour maintenir votre véhicule actif.\nL'équipe GoCab Operations.",
  },
  {
    id: "PAYMENT_WEEKLY_REMINDER",
    title: "🗓️ Rappel Versement Hebdo (1800 MAD)",
    category: "Recouvrement",
    text: "Bonjour {{name}},\n\nVotre versement hebdomadaire GoCab de 1,800 MAD est attendu ce lundi.\nSolde actuel : {{arrears}} MAD.\n\nMerci de procéder au versement dès aujourd'hui.\nL'équipe GoCab Operations.",
  },
  {
    id: "TRAINING_INVITATION",
    title: "🎓 Convocation Formation Chauffeur",
    category: "Recrutement",
    text: "Bonjour {{name}},\n\nVotre session de formation chauffeur GoCab est confirmée pour le {{date}} à 10h00 à notre agence.\n\nDocuments obligatoires à présenter :\n- Permis de conduire original (2+ ans)\n- Carte Nationale d'Identité (CIN)\n- Fiche anthropométrique\n\nMerci de confirmer votre présence par retour de message.",
  },
  {
    id: "MISSING_DOCS",
    title: "📄 Relance Documents Manquants",
    category: "Recrutement",
    text: "Bonjour {{name}},\n\nAfin de valider votre dossier et de procéder à l'attribution de votre véhicule GoCab, merci de nous envoyer une photo lisible de votre CIN et de votre permis de conduire recto/verso.\n\nL'équipe GoCab Recrutement.",
  },
  {
    id: "RECOVERY_WARNING",
    title: "🚨 Alerte Blocage Télématique (Impayé)",
    category: "Urgent",
    text: "URGENT {{name}},\n\nVotre véhicule GoCab ({{plate}}) présente un impayé de {{arrears}} MAD depuis plusieurs jours.\n\nSans régularisation dans les plus brefs délais, une procédure d'immobilisation télématique et de récupération sur le terrain sera déclenchée.\nContactez le bureau GoCab sans attendre.",
  },
  {
    id: "SUPPORT_RESOLVED",
    title: "✅ Véhicule Disponible / Réparation Terminée",
    category: "Support",
    text: "Bonjour {{name}},\n\nL'intervention technique sur votre véhicule ({{plate}}) est terminée. Votre véhicule est prêt et disponible pour reprise de service.\n\nBonne route avec GoCab !",
  },
];
