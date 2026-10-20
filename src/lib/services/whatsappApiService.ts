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
  templateName?: string;
  templateLanguage?: string;
  interactiveButtons?: Array<{ id: string; title: string }>;
  mediaUrl?: string;
  mediaType?: "image" | "document" | "audio" | "video";
}

export interface InboundMessagePayload {
  fromPhone: string;
  contactName?: string;
  text: string;
  waMessageId?: string;
  mediaUrl?: string;
  interactiveReplyId?: string;
  skipBotWorkflow?: boolean;
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
        "workflow_state" TEXT NOT NULL DEFAULT 'NONE',
        "routed_department" TEXT,
        "matched_plate" TEXT,
        "matched_vehicle_id" TEXT,
        "unread_count" INTEGER NOT NULL DEFAULT 0,
        "last_message" TEXT,
        "last_message_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "is_pinned" BOOLEAN NOT NULL DEFAULT 0,
        "is_archived" BOOLEAN NOT NULL DEFAULT 0,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "WhatsAppConversation" ADD COLUMN "workflow_state" TEXT NOT NULL DEFAULT 'NONE'`
      );
    } catch (_) {}
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "WhatsAppConversation" ADD COLUMN "routed_department" TEXT`
      );
    } catch (_) {}
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "WhatsAppConversation" ADD COLUMN "matched_plate" TEXT`
      );
    } catch (_) {}
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "WhatsAppConversation" ADD COLUMN "matched_vehicle_id" TEXT`
      );
    } catch (_) {}

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

export interface ResolvedContactInfo {
  type: "DRIVER" | "LEAD" | "UNKNOWN";
  name: string | null;
  department: "FLEET_SUPPORT" | "LEAD_ACQUISITION" | null;
  workflowState: "ROUTED_DRIVER_SUPPORT" | "ROUTED_LEAD_ACQUISITION" | "NONE";
  driver: any | null;
  lead: any | null;
  vehicle: any | null;
  plate: string | null;
  vehicleId: string | null;
  model: string | null;
}

/**
 * Robust phone-based entity resolution across Fleet Drivers and Leads/Training Pipeline.
 * Checks Drivers first, then Leads/Training candidates, before declaring a contact UNKNOWN.
 */
export async function resolveContactByPhone(phoneNumber: string): Promise<ResolvedContactInfo> {
  const cleanPhone = normalizeWhatsAppPhone(phoneNumber);
  if (!cleanPhone) {
    return {
      type: "UNKNOWN",
      name: null,
      department: null,
      workflowState: "NONE",
      driver: null,
      lead: null,
      vehicle: null,
      plate: null,
      vehicleId: null,
      model: null,
    };
  }

  const short9 = cleanPhone.slice(-9);
  const plusPhone = `+${cleanPhone}`;
  const localPhone = `0${short9}`;
  const phoneVariants = [cleanPhone, plusPhone, localPhone, short9];

  // 1. Check DriverProfile (Active Fleet Drivers)
  let matchedDriver: any = null;
  try {
    matchedDriver = await prisma.driverProfile.findFirst({
      where: {
        is_archived: false,
        OR: [
          { phoneSanitized: { in: phoneVariants } },
          { phoneSanitized: { contains: short9 } },
        ],
      },
      include: { assignedVehicle: true },
    });
  } catch (err) {
    console.warn("Driver lookup warning:", err);
  }

  if (matchedDriver) {
    const plate = matchedDriver.assignedVehicle?.plate_number || null;
    const vehicleId = matchedDriver.assignedVehicle?.id || null;
    const model = matchedDriver.assignedVehicle?.make_model || null;
    return {
      type: "DRIVER",
      name: matchedDriver.fullName,
      department: "FLEET_SUPPORT",
      workflowState: "ROUTED_DRIVER_SUPPORT",
      driver: matchedDriver,
      lead: null,
      vehicle: matchedDriver.assignedVehicle || null,
      plate,
      vehicleId,
      model,
    };
  }

  // Also check if any vehicle has this driver phone assigned
  try {
    const matchedVehicle = await prisma.vehicle.findFirst({
      where: {
        is_archived: false,
        driverProfile: {
          phoneSanitized: { contains: short9 },
        },
      },
      include: { driverProfile: true },
    });
    if (matchedVehicle && matchedVehicle.driverProfile) {
      return {
        type: "DRIVER",
        name: matchedVehicle.driverProfile.fullName,
        department: "FLEET_SUPPORT",
        workflowState: "ROUTED_DRIVER_SUPPORT",
        driver: matchedVehicle.driverProfile,
        lead: null,
        vehicle: matchedVehicle,
        plate: matchedVehicle.plate_number,
        vehicleId: matchedVehicle.id,
        model: matchedVehicle.make_model,
      };
    }
  } catch (_) {}

  // 2. Check Lead (All Leads & Training Candidates)
  let matchedLead: any = null;
  try {
    matchedLead = await prisma.lead.findFirst({
      where: {
        is_archived: false,
        OR: [
          { sanitized_phone: { in: phoneVariants } },
          { sanitized_phone: { contains: short9 } },
        ],
      },
      orderBy: { updated_at: "desc" },
    });
  } catch (err) {
    console.warn("Lead lookup warning:", err);
  }

  if (matchedLead) {
    return {
      type: "LEAD",
      name: matchedLead.raw_name,
      department: "LEAD_ACQUISITION",
      workflowState: "ROUTED_LEAD_ACQUISITION",
      driver: null,
      lead: matchedLead,
      vehicle: null,
      plate: null,
      vehicleId: null,
      model: null,
    };
  }

  // 3. Unknown Contact
  return {
    type: "UNKNOWN",
    name: null,
    department: null,
    workflowState: "NONE",
    driver: null,
    lead: null,
    vehicle: null,
    plate: null,
    vehicleId: null,
    model: null,
  };
}

/**
 * Automatically syncs and repairs any existing WhatsApp conversations in the DB:
 * - Drivers are moved to FLEET_SUPPORT / ROUTED_DRIVER_SUPPORT with plate & driver_id.
 * - Leads (including Training candidates) are moved to LEAD_ACQUISITION / ROUTED_LEAD_ACQUISITION with lead_id.
 */
export async function syncAllWhatsAppConversations(): Promise<void> {
  await ensureWhatsAppTables();
  try {
    const convs = await getDbConv().findMany({
      where: { is_archived: false },
    });
    for (const c of convs) {
      const info = await resolveContactByPhone(c.phone_number);
      if (info.type === "DRIVER") {
        if (
          c.contact_type !== "DRIVER" ||
          c.routed_department !== "FLEET_SUPPORT" ||
          c.workflow_state !== "ROUTED_DRIVER_SUPPORT" ||
          !c.driver_id ||
          (!c.matched_plate && info.plate)
        ) {
          await getDbConv().update({
            where: { id: c.id },
            data: {
              contact_type: "DRIVER",
              routed_department: "FLEET_SUPPORT",
              workflow_state: "ROUTED_DRIVER_SUPPORT",
              driver_id: info.driver?.id || c.driver_id,
              matched_plate: info.plate || c.matched_plate,
              matched_vehicle_id: info.vehicleId || c.matched_vehicle_id,
              contact_name: info.name || c.contact_name,
            },
          }).catch(() => {});
        }
      } else if (info.type === "LEAD") {
        if (
          c.contact_type !== "LEAD" ||
          c.routed_department !== "LEAD_ACQUISITION" ||
          c.workflow_state !== "ROUTED_LEAD_ACQUISITION" ||
          !c.lead_id
        ) {
          await getDbConv().update({
            where: { id: c.id },
            data: {
              contact_type: "LEAD",
              routed_department: "LEAD_ACQUISITION",
              workflow_state: "ROUTED_LEAD_ACQUISITION",
              lead_id: info.lead?.id || c.lead_id,
              contact_name: info.name || c.contact_name,
            },
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn("syncAllWhatsAppConversations warning:", err);
  }
}

/**
 * Finds or creates a WhatsApp conversation, auto-linking to GoCab Drivers or Leads
 */
export async function findOrCreateConversation(phoneNumber: string, contactName?: string) {
  const cleanPhone = normalizeWhatsAppPhone(phoneNumber);
  if (!cleanPhone) throw new Error("Numéro de téléphone invalide");

  await ensureWhatsAppTables();

  const contactInfo = await resolveContactByPhone(cleanPhone);

  let conversation: any = null;
  try {
    conversation = await getDbConv().findUnique({
      where: { phone_number: cleanPhone },
    });
  } catch (err: any) {
    if (err?.message?.includes("no such table") || err?.message?.includes("no such column")) {
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
    // If contact exists in DB, ensure it is properly classified and linked
    let updateData: any = null;
    if (contactInfo.type === "DRIVER") {
      const needsUpdate =
        conversation.contact_type !== "DRIVER" ||
        conversation.routed_department !== "FLEET_SUPPORT" ||
        conversation.workflow_state !== "ROUTED_DRIVER_SUPPORT" ||
        !conversation.driver_id ||
        (!conversation.matched_plate && contactInfo.plate);

      if (needsUpdate) {
        updateData = {
          contact_type: "DRIVER",
          routed_department: "FLEET_SUPPORT",
          workflow_state: "ROUTED_DRIVER_SUPPORT",
          driver_id: contactInfo.driver?.id || conversation.driver_id,
          matched_plate: contactInfo.plate || conversation.matched_plate,
          matched_vehicle_id: contactInfo.vehicleId || conversation.matched_vehicle_id,
          contact_name: contactInfo.name || conversation.contact_name,
        };
      }
    } else if (contactInfo.type === "LEAD") {
      const needsUpdate =
        conversation.contact_type !== "LEAD" ||
        conversation.routed_department !== "LEAD_ACQUISITION" ||
        conversation.workflow_state !== "ROUTED_LEAD_ACQUISITION" ||
        !conversation.lead_id;

      if (needsUpdate) {
        updateData = {
          contact_type: "LEAD",
          routed_department: "LEAD_ACQUISITION",
          workflow_state: "ROUTED_LEAD_ACQUISITION",
          lead_id: contactInfo.lead?.id || conversation.lead_id,
          contact_name: contactInfo.name || conversation.contact_name,
        };
      }
    }

    if (updateData) {
      try {
        conversation = await getDbConv().update({
          where: { id: conversation.id },
          data: updateData,
        });
      } catch (_) {}
    }

    return conversation;
  }

  // Create new conversation pre-routed to the correct department
  const finalName =
    contactName ||
    contactInfo.name ||
    `Contact +${cleanPhone}`;

  try {
    conversation = await getDbConv().create({
      data: {
        phone_number: cleanPhone,
        contact_name: finalName,
        driver_id: contactInfo.type === "DRIVER" ? contactInfo.driver?.id : null,
        lead_id: contactInfo.type === "LEAD" ? contactInfo.lead?.id : null,
        contact_type: contactInfo.type,
        workflow_state: contactInfo.workflowState,
        routed_department: contactInfo.department,
        matched_plate: contactInfo.plate,
        matched_vehicle_id: contactInfo.vehicleId,
        unread_count: 0,
        last_message: "Conversation initiée",
        last_message_at: new Date(),
        is_archived: false,
        is_pinned: false,
      },
    });
  } catch (err: any) {
    if (err?.message?.includes("no such table") || err?.message?.includes("no such column")) {
      tablesEnsured = false;
      await ensureWhatsAppTables();
      conversation = await getDbConv().create({
        data: {
          phone_number: cleanPhone,
          contact_name: finalName,
          driver_id: contactInfo.type === "DRIVER" ? contactInfo.driver?.id : null,
          lead_id: contactInfo.type === "LEAD" ? contactInfo.lead?.id : null,
          contact_type: contactInfo.type,
          workflow_state: contactInfo.workflowState,
          routed_department: contactInfo.department,
          matched_plate: contactInfo.plate,
          matched_vehicle_id: contactInfo.vehicleId,
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
 * Sends an outbound WhatsApp message via 360dialog / Meta Cloud API and logs to DB
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

  const buildPayload = (useInteractive: boolean, asTemplate = false) => {
    // If sending an official approved template (e.g. 360dialog / Meta approved "formation" or "vendredi")
    if (asTemplate && opts.templateName) {
      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
          name: opts.templateName,
          language: {
            code: opts.templateLanguage || "ar",
          },
        },
      };
    }

    if (opts.mediaUrl) {
      const mediaIdMatch = opts.mediaUrl.match(/\/api\/whatsapp\/media\/([a-zA-Z0-9_-]+)/);
      const mediaId = mediaIdMatch ? mediaIdMatch[1] : undefined;
      const isLiveId = mediaId && !mediaId.startsWith("local-");

      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "image",
        image: isLiveId
          ? { id: mediaId, caption: opts.text && opts.text !== "📷 Photo" ? opts.text : undefined }
          : {
              link: opts.mediaUrl.startsWith("http")
                ? opts.mediaUrl
                : `https://${process.env.VERCEL_URL || "crm.gocab.ma"}${opts.mediaUrl}`,
              caption: opts.text && opts.text !== "📷 Photo" ? opts.text : undefined,
            },
      };
    }

    if (useInteractive && opts.interactiveButtons && opts.interactiveButtons.length > 0) {
      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: opts.text },
          action: {
            buttons: opts.interactiveButtons.slice(0, 3).map((b) => ({
              type: "reply",
              reply: {
                id: b.id,
                title: b.title.slice(0, 20), // Meta enforces max 20 chars on button title
              },
            })),
          },
        },
      };
    }
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: { body: opts.text },
    };
  };

  // Dispatch live WhatsApp Business API message
  if (config.isLiveConfigured) {
    if (config.provider === "360dialog" && config.d360ApiKey) {
      try {
        const d360Base = config.d360ApiUrl.replace(/\/$/, "");
        const hasInteractive = Boolean(opts.interactiveButtons && opts.interactiveButtons.length > 0);
        const hasTemplate = Boolean(opts.templateName);

        let d360Res: Response;
        let d360Data: any;

        if (hasTemplate) {
          // Send official approved WhatsApp template message (bypasses 24h customer window)
          d360Res = await fetch(`${d360Base}/messages`, {
            method: "POST",
            headers: {
              "D360-API-KEY": config.d360ApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(buildPayload(false, true)),
          });
          d360Data = await d360Res.json().catch(() => null);

          // If template dispatch was rejected, fallback to text payload
          if (!d360Res.ok) {
            console.warn("360dialog template attempt warning, trying text fallback:", d360Res.status, d360Data);
            const fallbackRes = await fetch(`${d360Base}/messages`, {
              method: "POST",
              headers: {
                "D360-API-KEY": config.d360ApiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(buildPayload(false, false)),
            });
            const fallbackData = await fallbackRes.json().catch(() => null);
            if (fallbackRes.ok && fallbackData?.messages?.[0]) {
              d360Res = fallbackRes;
              d360Data = fallbackData;
            }
          }
        } else {
          d360Res = await fetch(`${d360Base}/messages`, {
            method: "POST",
            headers: {
              "D360-API-KEY": config.d360ApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(buildPayload(hasInteractive, false)),
          });
          d360Data = await d360Res.json().catch(() => null);

          // Fallback to standard text if interactive button payload was rejected
          if (!d360Res.ok && hasInteractive) {
            d360Res = await fetch(`${d360Base}/messages`, {
              method: "POST",
              headers: {
                "D360-API-KEY": config.d360ApiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(buildPayload(false, false)),
            });
            d360Data = await d360Res.json().catch(() => null);
          }
        }

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
        const hasInteractive = Boolean(opts.interactiveButtons && opts.interactiveButtons.length > 0);
        const hasTemplate = Boolean(opts.templateName);

        let metaRes: Response;
        let metaData: any;

        if (hasTemplate) {
          metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(buildPayload(false, true)),
            }
          );
          metaData = await metaRes.json().catch(() => null);

          if (!metaRes.ok) {
            console.warn("Meta template warning, trying text fallback:", metaData);
            const fallbackRes = await fetch(
              `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${config.accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(buildPayload(false, false)),
              }
            );
            const fallbackData = await fallbackRes.json().catch(() => null);
            if (fallbackRes.ok && fallbackData?.messages?.[0]) {
              metaRes = fallbackRes;
              metaData = fallbackData;
            }
          }
        } else {
          metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(buildPayload(hasInteractive, false)),
            }
          );
          metaData = await metaRes.json().catch(() => null);
        }

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
      media_url: opts.mediaUrl || null,
      error_message: apiError || null,
    },
  });

  // Update conversation's last message and transition to HUMAN_AGENT if an agent replied
  const isAgentSender = opts.senderName !== "🤖 Bot GoCab";
  const shouldSetHuman =
    isAgentSender &&
    (conversation.workflow_state === "NONE" ||
      conversation.workflow_state === "AWAITING_MENU_CHOICE" ||
      conversation.workflow_state === "AWAITING_IMMAT");

  await getDbConv().update({
    where: { id: conversation.id },
    data: {
      last_message: opts.text,
      last_message_at: new Date(),
      ...(shouldSetHuman ? { workflow_state: "HUMAN_AGENT" } : {}),
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
 * Sends the 2-option interactive GoCab Welcome Menu (1: Driver Support / 2: Getting Info)
 */
export async function sendWhatsAppWelcomeMenu(phoneNumber: string, conversationId?: string) {
  const cleanPhone = normalizeWhatsAppPhone(phoneNumber);
  if (!cleanPhone) throw new Error("Numéro de téléphone invalide");

  const conv = conversationId
    ? await getDbConv().findUnique({ where: { id: conversationId } })
    : await findOrCreateConversation(cleanPhone);

  if (conv) {
    await getDbConv().update({
      where: { id: conv.id },
      data: { workflow_state: "AWAITING_MENU_CHOICE" },
    });
  }

  const menuText =
    `Bonjour et bienvenue chez *GoCab* ! 🚖\n\n` +
    `Comment pouvons-nous vous aider aujourd'hui ?\n` +
    `Choisissez une option ci-dessous (ou répondez *1* ou *2*) :\n\n` +
    `1️⃣ *Contacter le Support Chauffeur* (Flotte & Assistance)\n` +
    `2️⃣ *Obtenir des informations* (Devenir Chauffeur GoCab)`;

  return sendOutboundWhatsAppMessage({
    conversationId: conv?.id,
    phoneNumber: cleanPhone,
    senderName: "🤖 Bot GoCab",
    text: menuText,
    interactiveButtons: [
      { id: "FLOW_DRIVER_SUPPORT", title: "1. Support Chauffeur" },
      { id: "FLOW_GET_INFO", title: "2. Infos GoCab" },
    ],
  });
}

/**
 * Matches a vehicle and its assigned driver in the database from a free-text immatriculation string
 */
export async function matchVehicleByImmat(rawImmat: string) {
  const cleanAlnum = rawImmat.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").toUpperCase();
  const digitsOnly = rawImmat.replace(/\D/g, "");

  if (cleanAlnum.length < 2 && digitsOnly.length < 2) {
    return { vehicle: null, driver: null, normalizedInput: rawImmat.trim().toUpperCase() };
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { is_archived: false },
    include: { driverProfile: true },
  });

  // 1. Exact normalized match
  let matched = vehicles.find(
    (v) => v.plate_number.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").toUpperCase() === cleanAlnum
  );

  // 2. Partial normalized match (e.g., driver wrote "12345A6" or "12345-A")
  if (!matched && cleanAlnum.length >= 4) {
    matched = vehicles.find((v) => {
      const vClean = v.plate_number.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").toUpperCase();
      return vClean.includes(cleanAlnum) || cleanAlnum.includes(vClean);
    });
  }

  // 3. Digits prefix match (e.g., driver wrote "12345" for "12345-A-6")
  if (!matched && digitsOnly.length >= 3) {
    matched = vehicles.find((v) => {
      const vDigits = v.plate_number.replace(/\D/g, "");
      return vDigits === digitsOnly || (digitsOnly.length >= 4 && vDigits.startsWith(digitsOnly));
    });
  }

  let driver = matched?.driverProfile || null;
  if (matched && !driver) {
    driver = await prisma.driverProfile
      .findFirst({
        where: { assignedVehicleId: matched.id },
      })
      .catch(() => null);
  }

  return {
    vehicle: matched || null,
    driver,
    normalizedInput: matched ? matched.plate_number : rawImmat.trim().toUpperCase().slice(0, 24),
  };
}

/**
 * Routes a conversation to Fleet Performance Support with the matched vehicle immatriculation
 */
export async function routeConversationByImmat(
  conversationId: string,
  rawImmat: string,
  sendBotReply = true
) {
  const conv = await getDbConv().findUnique({ where: { id: conversationId } });
  if (!conv) throw new Error("Conversation introuvable");

  const { vehicle, driver, normalizedInput } = await matchVehicleByImmat(rawImmat);
  const finalPlate = vehicle ? vehicle.plate_number : normalizedInput;
  const finalDriverName =
    driver?.fullName || vehicle?.assigned_driver_name || conv.contact_name;

  const updatedConv = await getDbConv().update({
    where: { id: conversationId },
    data: {
      workflow_state: "ROUTED_DRIVER_SUPPORT",
      routed_department: "FLEET_SUPPORT",
      contact_type: "DRIVER",
      matched_plate: finalPlate,
      matched_vehicle_id: vehicle ? vehicle.id : null,
      driver_id: driver ? driver.id : conv.driver_id,
      contact_name: finalDriverName,
    },
  });

  // Also log/sync a VehicleIssue in Journal Flotte / Fleet Performance Support if none is open today for this plate
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const existingIssue = await prisma.vehicleIssue.findFirst({
      where: {
        plate_number: finalPlate,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        created_at: { gte: startOfToday },
      },
    });

    if (!existingIssue) {
      await prisma.vehicleIssue.create({
        data: {
          vehicle_id: vehicle ? vehicle.id : null,
          plate_number: finalPlate,
          driver_name: finalDriverName,
          driver_phone: `+${conv.phone_number}`,
          category: "CHAUFFEUR",
          title: `💬 Support WhatsApp — Immat ${finalPlate}`,
          description: `Le chauffeur (${finalDriverName} / +${conv.phone_number}) a ouvert une session Support sur WhatsApp avec le matricule ${finalPlate}.`,
          priority: "Urgent",
          status: "PENDING",
          reported_by_name: "Bot WhatsApp GoCab",
          reported_by_role: "WHATSAPP_BOT",
        },
      });
    }
  } catch (e) {
    console.warn("Could not auto-create VehicleIssue from WhatsApp immat:", e);
  }

  if (sendBotReply) {
    const replyText = vehicle
      ? `✅ Véhicule *${finalPlate}* (${vehicle.make_model}) identifié !\n` +
        `👤 Chauffeur : *${finalDriverName}*\n\n` +
        `Votre discussion est maintenant ouverte auprès de l'équipe *Support & Performance Flotte*.\n` +
        `✍️ Vous pouvez écrire votre demande ou incident ci-dessous, un responsable vous répond immédiatement.`
      : `✅ Matricule *${finalPlate}* enregistré !\n\n` +
        `Votre discussion est maintenant transférée à l'équipe *Support & Performance Flotte*.\n` +
        `✍️ Décrivez votre demande ou incident ci-dessous, un responsable vous répond immédiatement.`;

    await sendOutboundWhatsAppMessage({
      conversationId,
      phoneNumber: conv.phone_number,
      senderName: "🤖 Bot GoCab",
      text: replyText,
    });
  }

  return { conversation: updatedConv, vehicle, driver, matchedPlate: finalPlate };
}

/**
 * Routes a conversation directly to Lead Acquisition and ensures a Lead card exists in NEW_LEADS
 */
export async function routeConversationToLeadAcquisition(
  conversationId: string,
  contactName?: string,
  sendBotReply = true
) {
  const conv = await getDbConv().findUnique({ where: { id: conversationId } });
  if (!conv) throw new Error("Conversation introuvable");

  const shortPhone = conv.phone_number.slice(-9);
  let lead = await prisma.lead
    .findFirst({
      where: { sanitized_phone: { contains: shortPhone } },
    })
    .catch(() => null);

  const sanitizedForLead = conv.phone_number.startsWith("+")
    ? conv.phone_number
    : `+${conv.phone_number}`;

  if (!lead) {
    try {
      lead = await prisma.lead.create({
        data: {
          raw_name:
            contactName ||
            (conv.contact_name && !conv.contact_name.startsWith("Contact +")
              ? conv.contact_name
              : `Prospect WhatsApp +${shortPhone}`),
          sanitized_phone: sanitizedForLead,
          campaign_source: "WhatsApp Bot (Infos)",
          board_column: "NEW_LEADS",
          city: "Casablanca",
          notes: "Créé automatiquement via le workflow WhatsApp (Option 2 : Obtenir des informations).",
        },
      });

      await prisma.leadActivityLog
        .create({
          data: {
            lead_id: lead.id,
            agent: "Bot WhatsApp",
            action: "LEAD_CREATED_WHATSAPP",
            detail: "Prospect redirigé vers Lead Acquisition via Option 2 (Demande d'informations)",
          },
        })
        .catch(() => {});
    } catch (e) {
      // Fallback lookup if unique constraint raced
      lead = await prisma.lead
        .findFirst({
          where: { sanitized_phone: { contains: shortPhone } },
        })
        .catch(() => null);
    }
  } else if (lead.is_archived) {
    lead = await prisma.lead
      .update({
        where: { id: lead.id },
        data: { is_archived: false },
      })
      .catch(() => lead);
  }

  const updatedConv = await getDbConv().update({
    where: { id: conversationId },
    data: {
      workflow_state: "ROUTED_LEAD_ACQUISITION",
      routed_department: "LEAD_ACQUISITION",
      contact_type: "LEAD",
      lead_id: lead ? lead.id : conv.lead_id,
    },
  });

  if (sendBotReply) {
    const replyText =
      `👋 Merci pour votre intérêt pour *GoCab* !\n\n` +
      `Votre demande est transmise directement à notre équipe *Acquisition & Recrutement Chauffeurs*.\n` +
      `📋 Pour accélérer votre inscription, merci de nous indiquer ci-dessous :\n` +
      `• Votre *Nom et Prénom*\n` +
      `• Votre *Ville* (Casablanca, Rabat...)\n` +
      `• Si vous possédez le *Permis B (+2 ans)*\n\n` +
      `Un conseiller prend le relais dans cette discussion !`;

    await sendOutboundWhatsAppMessage({
      conversationId,
      phoneNumber: conv.phone_number,
      senderName: "🤖 Bot GoCab",
      text: replyText,
    });
  }

  return { conversation: updatedConv, lead };
}

/**
 * Evaluates the automated 2-option WhatsApp workflow on every inbound customer message
 */
async function processInboundBotWorkflow(
  conversation: any,
  inboundText: string,
  interactiveReplyId?: string,
  contactName?: string
) {
  const trimmed = (inboundText || "").trim();
  const lower = trimmed.toLowerCase();

  // =========================================================================
  // CRITICAL PRE-CHECK: VERIFY NUMBER IN DRIVERS LIST OR LEADS/TRAINING PAGE
  // =========================================================================
  const contactInfo = await resolveContactByPhone(conversation.phone_number);

  // CASE 1: Number exists in Drivers list
  // -> Transfer directly to Support Flotte discussion with all driver & vehicle info
  // -> NEVER ask "Contacter le Support Chauffeur" or "Obtenir des informations"!
  if (contactInfo.type === "DRIVER") {
    if (
      conversation.workflow_state !== "ROUTED_DRIVER_SUPPORT" ||
      conversation.routed_department !== "FLEET_SUPPORT" ||
      conversation.contact_type !== "DRIVER" ||
      !conversation.driver_id ||
      (!conversation.matched_plate && contactInfo.plate)
    ) {
      await getDbConv().update({
        where: { id: conversation.id },
        data: {
          workflow_state: "ROUTED_DRIVER_SUPPORT",
          routed_department: "FLEET_SUPPORT",
          contact_type: "DRIVER",
          driver_id: contactInfo.driver?.id || conversation.driver_id,
          matched_plate: contactInfo.plate || conversation.matched_plate,
          matched_vehicle_id: contactInfo.vehicleId || conversation.matched_vehicle_id,
          contact_name: contactInfo.name || conversation.contact_name,
        },
      });
    }

    // If driver has a plate, append message to today's open vehicle issue if one exists
    if (contactInfo.plate) {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const openIssue = await prisma.vehicleIssue.findFirst({
          where: {
            plate_number: contactInfo.plate,
            reported_by_role: "WHATSAPP_BOT",
            status: { in: ["PENDING", "IN_PROGRESS"] },
            created_at: { gte: startOfToday },
          },
          orderBy: { created_at: "desc" },
        });
        if (openIssue) {
          await prisma.vehicleIssue.update({
            where: { id: openIssue.id },
            data: {
              description: `${openIssue.description}\n• Message chauffeur : "${trimmed}"`,
            },
          });
        }
      } catch (_) {}
    }

    // Direct routing: do NOT show welcome menu to registered drivers
    return;
  }

  // CASE 2: Number exists in Training or Leads page
  // -> Directly route to Lead Acquisition WhatsApp queue with all info
  // -> NEVER ask "Contacter le Support Chauffeur" or "Obtenir des informations"!
  if (contactInfo.type === "LEAD") {
    if (
      conversation.workflow_state !== "ROUTED_LEAD_ACQUISITION" ||
      conversation.routed_department !== "LEAD_ACQUISITION" ||
      conversation.contact_type !== "LEAD" ||
      !conversation.lead_id
    ) {
      await getDbConv().update({
        where: { id: conversation.id },
        data: {
          workflow_state: "ROUTED_LEAD_ACQUISITION",
          routed_department: "LEAD_ACQUISITION",
          contact_type: "LEAD",
          lead_id: contactInfo.lead?.id || conversation.lead_id,
          contact_name: contactInfo.name || conversation.contact_name,
        },
      });
    }

    // Direct routing: do NOT show welcome menu to registered leads / training candidates
    return;
  }

  // =========================================================================
  // CASE 3: NUMBER IS TRULY UNKNOWN (NEITHER DRIVER NOR LEAD)
  // Only for unknown contacts should the 2-option bot menu interact
  // =========================================================================
  const state = conversation.workflow_state || "NONE";

  // 0. If conversation is in Human Agent takeover or explicitly paused, DO NOT trigger bot
  if (state === "HUMAN_AGENT" || state === "BOT_PAUSED") {
    return;
  }

  // 0.1 Check if any human agent has ever replied in this conversation
  const recentAgentMsg = await getDbMsg().findFirst({
    where: {
      conversation_id: conversation.id,
      direction: "OUTBOUND",
      sender_name: { not: "🤖 Bot GoCab" },
    },
  });

  if (recentAgentMsg) {
    if (state === "NONE" || state === "AWAITING_MENU_CHOICE") {
      await getDbConv().update({
        where: { id: conversation.id },
        data: { workflow_state: "HUMAN_AGENT" },
      });
    }
    return;
  }

  const isMenuCommand = ["menu", "start", "0", "accueil", "aide", "help", "options"].includes(
    lower
  );

  const isOption1 =
    interactiveReplyId === "FLOW_DRIVER_SUPPORT" ||
    lower === "1" ||
    lower === "1️⃣" ||
    lower === "1. support chauffeur" ||
    lower === "support chauffeur" ||
    lower === "contact driver support";

  const isOption2 =
    interactiveReplyId === "FLOW_GET_INFO" ||
    lower === "2" ||
    lower === "2️⃣" ||
    lower === "2. infos gocab" ||
    lower === "getting information" ||
    lower === "obtenir des informations";

  // 1. Explicit menu command resets and sends the 2-option interactive menu
  if (isMenuCommand) {
    await sendWhatsAppWelcomeMenu(conversation.phone_number, conversation.id);
    return;
  }

  // 2. User clicked or typed Option 1 -> Ask for Immatriculation
  if (isOption1) {
    await getDbConv().update({
      where: { id: conversation.id },
      data: {
        workflow_state: "AWAITING_IMMAT",
        routed_department: "FLEET_SUPPORT",
      },
    });

    await sendOutboundWhatsAppMessage({
      conversationId: conversation.id,
      phoneNumber: conversation.phone_number,
      senderName: "🤖 Bot GoCab",
      text:
        `🚗 *Support Chauffeur GoCab*\n\n` +
        `Veuillez saisir le *numéro d'immatriculation (matricule)* de votre véhicule (ex: *12345-A-6* ou *12345*) afin d'ouvrir votre dossier auprès du *Support Performance Flotte* :`,
    });
    return;
  }

  // 3. User clicked or typed Option 2 -> Route directly to Lead Acquisition
  if (isOption2) {
    await routeConversationToLeadAcquisition(conversation.id, contactName, true);
    return;
  }

  // 4. Conversation is waiting for the driver's immatriculation -> Match Immat & Route to Fleet Support
  if (state === "AWAITING_IMMAT") {
    await routeConversationByImmat(conversation.id, trimmed, true);
    return;
  }

  // 5. Initial contact (state === "NONE") -> Send the 2-option Welcome Menu ONLY ONCE
  if (state === "NONE") {
    const welcomeAlreadySent = await getDbMsg().findFirst({
      where: {
        conversation_id: conversation.id,
        direction: "OUTBOUND",
        sender_name: "🤖 Bot GoCab",
      },
    });

    if (welcomeAlreadySent) {
      // Menu was already sent previously; route to Lead Acquisition silently without spamming
      await routeConversationToLeadAcquisition(conversation.id, contactName, false);
      return;
    }

    await sendWhatsAppWelcomeMenu(conversation.phone_number, conversation.id);
    return;
  }

  // 6. If waiting for menu choice (state === "AWAITING_MENU_CHOICE") and user typed free text
  if (state === "AWAITING_MENU_CHOICE") {
    // Check if they typed an immatriculation directly or keywords
    if (
      lower.includes("info") ||
      lower.includes("insta") ||
      lower.includes("offre") ||
      lower.includes("inscription") ||
      lower.includes("travail") ||
      lower.includes("formule") ||
      lower.includes("condition")
    ) {
      await routeConversationToLeadAcquisition(conversation.id, contactName, true);
      return;
    }
    if (
      lower.includes("support") ||
      lower.includes("panne") ||
      lower.includes("garage") ||
      lower.includes("accident") ||
      lower.includes("vidange")
    ) {
      await getDbConv().update({
        where: { id: conversation.id },
        data: {
          workflow_state: "AWAITING_IMMAT",
          routed_department: "FLEET_SUPPORT",
        },
      });
      await sendOutboundWhatsAppMessage({
        conversationId: conversation.id,
        phoneNumber: conversation.phone_number,
        senderName: "🤖 Bot GoCab",
        text:
          `🚗 *Support Chauffeur GoCab*\n\n` +
          `Veuillez saisir le *numéro d'immatriculation (matricule)* de votre véhicule (ex: *12345-A-6* ou *12345*) :`,
      });
      return;
    }

    // DO NOT RE-SEND THE WELCOME MENU!
    // The customer is sending free-form text (e.g. asking a question, replying "siege", etc.).
    // Transfer directly to Lead Acquisition / Human discussion without sending any bot message!
    await routeConversationToLeadAcquisition(conversation.id, contactName, false);
    return;
  }

  // 7. If already routed to ROUTED_DRIVER_SUPPORT, append the driver's message to today's pending VehicleIssue if one exists
  if (state === "ROUTED_DRIVER_SUPPORT" && conversation.matched_plate) {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const openIssue = await prisma.vehicleIssue.findFirst({
        where: {
          plate_number: conversation.matched_plate,
          reported_by_role: "WHATSAPP_BOT",
          status: { in: ["PENDING", "IN_PROGRESS"] },
          created_at: { gte: startOfToday },
        },
        orderBy: { created_at: "desc" },
      });
      if (openIssue) {
        await prisma.vehicleIssue.update({
          where: { id: openIssue.id },
          data: {
            description: `${openIssue.description}\n• Message chauffeur : "${trimmed}"`,
          },
        });
      }
    } catch (_) {}
  }
}

/**
 * Handles incoming WhatsApp message (from Webhook or Simulator)
 */
export async function handleInboundWhatsAppMessage(payload: InboundMessagePayload) {
  const cleanPhone = normalizeWhatsAppPhone(payload.fromPhone);
  if (!cleanPhone) throw new Error("Numéro de téléphone expéditeur invalide");

  // Deduplicate if Meta retries the same webhook event
  if (payload.waMessageId) {
    const existing = await getDbMsg().findFirst({
      where: { wa_message_id: payload.waMessageId },
    });
    if (existing) {
      return { success: true, message: existing, conversationId: existing.conversation_id };
    }
  }

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

  // Run automated 2-option routing workflow unless explicitly skipped (e.g., reaction emoji)
  const isReaction = payload.text.startsWith("Réaction ") || payload.text.includes("[reaction]");
  if (!payload.skipBotWorkflow && !isReaction) {
    try {
      await processInboundBotWorkflow(
        conversation,
        payload.text,
        payload.interactiveReplyId,
        payload.contactName
      );
    } catch (workflowErr) {
      console.error("WhatsApp bot workflow error:", workflowErr);
    }
  }

  return { success: true, message, conversationId: conversation.id };
}

/**
 * Handles outbound message echoes sent from the WhatsApp Business Mobile App in COEX (Coexistence) mode
 */
export async function handleEchoWhatsAppMessage(payload: {
  toPhone: string;
  text: string;
  waMessageId?: string;
  mediaUrl?: string;
}) {
  const cleanPhone = normalizeWhatsAppPhone(payload.toPhone);
  if (!cleanPhone) return { success: false };

  if (payload.waMessageId) {
    const existing = await getDbMsg().findFirst({
      where: { wa_message_id: payload.waMessageId },
    });
    if (existing) {
      return { success: true, message: existing, conversationId: existing.conversation_id };
    }
  }

  const conversation = await findOrCreateConversation(cleanPhone);

  const message = await getDbMsg().create({
    data: {
      conversation_id: conversation.id,
      direction: "OUTBOUND",
      sender_type: "AGENT",
      sender_name: "GoCab Mobile (COEX)",
      text: payload.text,
      status: "SENT",
      wa_message_id: payload.waMessageId || `echo-${Date.now()}`,
      media_url: payload.mediaUrl || null,
    },
  });

  const shouldSetHuman =
    conversation.workflow_state === "NONE" ||
    conversation.workflow_state === "AWAITING_MENU_CHOICE" ||
    conversation.workflow_state === "AWAITING_IMMAT";

  await getDbConv().update({
    where: { id: conversation.id },
    data: {
      last_message: payload.text,
      last_message_at: new Date(),
      ...(shouldSetHuman ? { workflow_state: "HUMAN_AGENT" } : {}),
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
