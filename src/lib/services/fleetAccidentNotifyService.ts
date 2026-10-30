import crypto from "crypto";
import { prisma, flushDatabaseSync } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { resolveVehicleFleetManager } from "@/lib/fleet-managers";

export type FleetManagerKey = "mehdi elyattouti" | "mohamed aziz";

export interface FleetManagerContact {
  key: FleetManagerKey;
  name: string;
  firstName: string;
  phone: string; // normalized digits e.g. "212667960025"
  displayPhone: string;
}

export const FLEET_MANAGER_CONTACTS: Record<FleetManagerKey, FleetManagerContact> = {
  "mehdi elyattouti": {
    key: "mehdi elyattouti",
    name: "Mehdi Elyattouti",
    firstName: "Mehdi",
    phone: "212667960025",
    displayPhone: "+212 66 796-0025",
  },
  "mohamed aziz": {
    key: "mohamed aziz",
    name: "Mohamed Aziz",
    firstName: "Mohamed Aziz",
    phone: "212666563066",
    displayPhone: "+212 66 656-3066",
  },
};

export interface FleetAccidentSyncMeta {
  fleet_manager_key?: FleetManagerKey;
  fleet_manager_name?: string;
  fleet_manager_phone?: string;
  fleet_whatsapp_notified?: boolean;
  fleet_whatsapp_notified_at?: string | null;
  fleet_whatsapp_status?: "SENT" | "DELIVERED" | "FAILED" | "PENDING" | null;
  fleet_whatsapp_window_open?: boolean;
  fleet_whatsapp_error?: string | null;
  fleet_confirm_url?: string | null;
  fleet_created_on_gocab_fleet?: boolean;
  fleet_created_at?: string | null;
  fleet_created_by?: string | null;
  fleet_created_source?: "WHATSAPP_BUTTON" | "WEB_LINK" | "CRM_MANUAL" | null;
}

function getHmacSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "81c134e63b7d02ddbdd6f6a3edae9042ace9af18cccada6e294bcc4998318c9f"
  );
}

/**
 * Generates a deterministic HMAC token for 1-click accident confirmation on GoCab Fleet.
 */
export function generateFleetConfirmToken(claimId: string): string {
  return crypto
    .createHmac("sha256", getHmacSecret())
    .update(`confirm-fleet-accident:${claimId}`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Timing-safe verification of the 1-click confirmation token.
 */
export function verifyFleetConfirmToken(
  claimId: string,
  token: string | null | undefined
): boolean {
  if (!claimId || !token) return false;
  const expected = generateFleetConfirmToken(claimId);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Resolves the Fleet Manager profile (Mehdi Elyattouti vs Mohamed Aziz) for a vehicle.
 */
export function resolveFleetManagerContactForVehicle(vehicle: {
  plate_number?: string | null;
  assigned_collector?: string | null;
  assigned_supervisor?: string | null;
}): FleetManagerContact {
  const key = resolveVehicleFleetManager(vehicle);
  return FLEET_MANAGER_CONTACTS[key];
}

/**
 * Extracts Fleet Sync metadata from AccidentClaim.comments JSON string.
 */
export function extractFleetSyncFromComments(
  commentsRaw: string | null | undefined
): FleetAccidentSyncMeta {
  if (!commentsRaw) return {};
  try {
    const parsed = JSON.parse(commentsRaw);
    if (!Array.isArray(parsed)) return {};
    const meta = parsed.find((c: any) => c && c.id === "INSURANCE_DOSSIER_META");
    if (!meta) return {};
    return {
      fleet_manager_key: meta.fleet_manager_key,
      fleet_manager_name: meta.fleet_manager_name,
      fleet_manager_phone: meta.fleet_manager_phone,
      fleet_whatsapp_notified: Boolean(meta.fleet_whatsapp_notified),
      fleet_whatsapp_notified_at: meta.fleet_whatsapp_notified_at || null,
      fleet_whatsapp_status: meta.fleet_whatsapp_status || null,
      fleet_whatsapp_window_open:
        typeof meta.fleet_whatsapp_window_open === "boolean"
          ? meta.fleet_whatsapp_window_open
          : undefined,
      fleet_whatsapp_error: meta.fleet_whatsapp_error || null,
      fleet_confirm_url: meta.fleet_confirm_url || null,
      fleet_created_on_gocab_fleet: Boolean(meta.fleet_created_on_gocab_fleet),
      fleet_created_at: meta.fleet_created_at || null,
      fleet_created_by: meta.fleet_created_by || null,
      fleet_created_source: meta.fleet_created_source || null,
    };
  } catch {
    return {};
  }
}

/**
 * Safely merges Fleet Sync metadata into AccidentClaim.comments without losing any
 * existing insurance dossier fields, notes, or chronological comments.
 */
export function mergeFleetSyncIntoComments(
  commentsRaw: string | null | undefined,
  patch: Partial<FleetAccidentSyncMeta>,
  auditComment?: {
    timeline_step: string;
    comment: string;
    author: string;
  },
  defaultPolicyNumber?: string | null
): string {
  let list: any[] = [];
  try {
    if (commentsRaw) {
      const parsed = JSON.parse(commentsRaw);
      if (Array.isArray(parsed)) list = [...parsed];
    }
  } catch {
    list = [];
  }

  const nowIso = new Date().toISOString();
  const metaIndex = list.findIndex((c: any) => c && c.id === "INSURANCE_DOSSIER_META");

  if (metaIndex >= 0) {
    list[metaIndex] = {
      ...list[metaIndex],
      ...patch,
    };
  } else {
    list.push({
      id: "INSURANCE_DOSSIER_META",
      type: "INSURANCE_INFO",
      timeline_step: "INSURANCE_DOCS",
      claim_number: "",
      insurance_company: "Sanlam",
      garage_name: "Emergence",
      policy_number: defaultPolicyNumber || "",
      claim_status: "DECLARED",
      declaration_date: nowIso.split("T")[0],
      expert_name: "",
      expert_phone: "",
      expertise_date: "",
      estimated_amount: 0,
      covered_amount: 0,
      franchise_amount: 0,
      payout_status: "PENDING",
      insurance_notes: [],
      updated_at: nowIso,
      updated_by: auditComment?.author || "Système",
      ...patch,
    });
  }

  if (auditComment) {
    list.unshift({
      id: crypto.randomUUID(),
      timeline_step: auditComment.timeline_step,
      comment: auditComment.comment,
      author: auditComment.author,
      created_at: nowIso,
    });
  }

  return JSON.stringify(list);
}

/**
 * Resolves public app origin for links sent to mobile WhatsApp devices.
 */
export function resolvePublicAppOrigin(requestUrl?: string | null): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "";
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return configured.replace(/\/$/, "");
  }
  if (requestUrl) {
    try {
      const parsed = new URL(requestUrl);
      if (!parsed.hostname.includes("localhost") && !parsed.hostname.includes("127.0.0.1")) {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {}
  }
  return "https://gocab-iota.vercel.app";
}

/**
 * Builds the WhatsApp notification text sent to Mohamed Aziz or Mehdi Elyattouti.
 */
export function buildFleetAccidentWhatsAppText(params: {
  managerFirstName: string;
  plateNumber: string;
  makeModel?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  hubCity?: string | null;
  reportedBy?: string | null;
  confirmUrl: string;
}): string {
  const modelPart = params.makeModel ? ` (${params.makeModel})` : "";
  const driverPart = params.driverName || "Non renseigné";
  const phonePart = params.driverPhone ? ` · ${params.driverPhone}` : "";
  const cityPart = params.hubCity || "Casablanca";
  const agentPart = params.reportedBy || "Agent CRM";

  return (
    `🚨 *ALERTE ACCIDENT — PORTEFEUILLE FLOTTE*\n\n` +
    `Bonjour *${params.managerFirstName}*, un nouveau dossier accident vient d'être ouvert sur le CRM GoCab :\n\n` +
    `🚗 *Véhicule :* ${params.plateNumber}${modelPart}\n` +
    `👤 *Chauffeur :* ${driverPart}${phonePart}\n` +
    `📍 *Hub :* ${cityPart}\n` +
    `🧑‍💻 *Déclaré par :* ${agentPart}\n\n` +
    `👉 Dès que l'accident est créé sur *GoCab Fleet*, cliquez sur le bouton *✅ Créé sur Fleet* ci-dessous (ou validez en 1 clic ici) :\n` +
    `${params.confirmUrl}`
  );
}

/**
 * Sends a WhatsApp notification (with interactive button "✅ Créé sur Fleet" + 1-click fallback link)
 * to the Fleet Manager who owns the vehicle (Mohamed Aziz or Mehdi Elyattouti), and records the state on the AccidentClaim.
 */
export async function notifyFleetManagerOfAccident(opts: {
  claimId: string;
  vehicle: {
    id?: string;
    plate_number: string;
    make_model?: string | null;
    hub_city?: string | null;
    insurance_policy_number?: string | null;
    assigned_collector?: string | null;
    assigned_supervisor?: string | null;
  };
  driverName?: string | null;
  driverPhone?: string | null;
  reportedBy?: string | null;
  requestUrl?: string | null;
  skipWhatsAppSend?: boolean;
}) {
  const manager = resolveFleetManagerContactForVehicle(opts.vehicle);
  const origin = resolvePublicAppOrigin(opts.requestUrl);
  const token = generateFleetConfirmToken(opts.claimId);
  const confirmUrl = `${origin}/confirm-fleet-accident/${opts.claimId}?t=${token}`;

  const messageText = buildFleetAccidentWhatsAppText({
    managerFirstName: manager.firstName,
    plateNumber: opts.vehicle.plate_number,
    makeModel: opts.vehicle.make_model,
    driverName: opts.driverName,
    driverPhone: opts.driverPhone,
    hubCity: opts.vehicle.hub_city,
    reportedBy: opts.reportedBy,
    confirmUrl,
  });

  const waMeFallbackUrl = `https://wa.me/${manager.phone}?text=${encodeURIComponent(messageText)}`;

  let whatsappSent = false;
  let whatsappStatus: "SENT" | "DELIVERED" | "FAILED" | "PENDING" = "PENDING";
  let whatsappError: string | null = null;
  let windowOpen24h = true;
  let targetPhone = manager.phone;

  if (!opts.skipWhatsAppSend) {
    try {
      const {
        ensureWhatsAppTables,
        getDbConv,
        hasInboundWithin24h,
        sendOutboundWhatsAppMessage,
        normalizeWhatsAppPhone,
      } = await import("./whatsappApiService");

      await ensureWhatsAppTables();
      const dbConv = getDbConv();

      // Lookup existing conversation for this Fleet Manager by phone (last 9 digits)
      const shortPhone = manager.phone.slice(-9);
      let conv = await dbConv
        .findFirst({
          where: { phone_number: { contains: shortPhone } },
          orderBy: { last_message_at: "desc" },
        })
        .catch(() => null);

      if (conv?.phone_number) {
        targetPhone = normalizeWhatsAppPhone(conv.phone_number) || manager.phone;
      }

      if (!conv) {
        conv = await dbConv.create({
          data: {
            phone_number: targetPhone,
            contact_name: manager.name,
            contact_type: "TEAM",
            workflow_state: "NONE",
            routed_department: null,
            unread_count: 0,
          },
        });
      } else if (
        conv.contact_type !== "TEAM" ||
        conv.routed_department !== null ||
        conv.contact_name.startsWith("Contact +")
      ) {
        conv = await dbConv
          .update({
            where: { id: conv.id },
            data: {
              contact_type: "TEAM",
              contact_name: conv.contact_name.startsWith("Contact +")
                ? manager.name
                : conv.contact_name,
              workflow_state: "NONE",
              routed_department: null,
            },
          })
          .catch(() => conv);
      }

      windowOpen24h = await hasInboundWithin24h(conv.id);

      const sendResult = await sendOutboundWhatsAppMessage({
        conversationId: conv.id,
        phoneNumber: targetPhone,
        senderName: opts.reportedBy || "GoCab Assurance CRM",
        text: messageText,
        interactiveButtons: [
          {
            id: `CONFIRM_FLEET_ACCIDENT:${opts.claimId}`,
            title: "✅ Créé sur Fleet",
          },
        ],
      });

      whatsappSent = Boolean(sendResult.success);
      whatsappStatus = sendResult.success ? "SENT" : "FAILED";
      whatsappError = sendResult.apiError || null;
    } catch (err: any) {
      console.error("Error notifying Fleet Manager on WhatsApp:", err);
      whatsappSent = false;
      whatsappStatus = "FAILED";
      whatsappError = err?.message || "Erreur d'envoi WhatsApp";
    }
  }

  // Persist notification metadata onto the AccidentClaim
  const currentClaim = await prisma.accidentClaim.findUnique({
    where: { id: opts.claimId },
  });

  let updatedClaim: any = currentClaim;
  if (currentClaim) {
    const existingMeta = extractFleetSyncFromComments(currentClaim.comments);
    const nowIso = new Date().toISOString();

    const updatedComments = mergeFleetSyncIntoComments(
      currentClaim.comments,
      {
        fleet_manager_key: manager.key,
        fleet_manager_name: manager.name,
        fleet_manager_phone: targetPhone,
        fleet_whatsapp_notified: whatsappSent,
        fleet_whatsapp_notified_at: nowIso,
        fleet_whatsapp_status: whatsappStatus,
        fleet_whatsapp_window_open: windowOpen24h,
        fleet_whatsapp_error: whatsappError,
        fleet_confirm_url: confirmUrl,
        fleet_created_on_gocab_fleet: Boolean(existingMeta.fleet_created_on_gocab_fleet),
      },
      {
        timeline_step: currentClaim.timeline_step || "NEW_ACCIDENT",
        comment: whatsappSent
          ? `📲 Gestionnaire de flotte prévenu sur WhatsApp : ${manager.name} (+${targetPhone}) — Bouton [✅ Créé sur Fleet] envoyé.`
          : `⚠️ Tentative de notification WhatsApp à ${manager.name} (+${targetPhone}) : ${whatsappError || "En attente"}`,
        author: opts.reportedBy || "Système CRM",
      },
      opts.vehicle.insurance_policy_number
    );

    updatedClaim = await prisma.accidentClaim.update({
      where: { id: opts.claimId },
      data: { comments: updatedComments },
      include: {
        vehicle: true,
        driver: true,
      },
    });

    await touchSyncState("tickets").catch(() => {});
    await touchSyncState("all").catch(() => {});
    await flushDatabaseSync().catch(() => {});
  }

  return {
    success: whatsappSent,
    manager,
    targetPhone,
    confirmUrl,
    waMeFallbackUrl,
    windowOpen24h,
    whatsappStatus,
    whatsappError,
    claim: updatedClaim,
  };
}

/**
 * Marks an AccidentClaim as "Done & Created on GoCab Fleet" when the Fleet Manager clicks
 * the WhatsApp interactive button, clicks the 1-click confirmation link, or confirms inside the CRM.
 */
export async function confirmAccidentCreatedOnFleet(opts: {
  claimId: string;
  confirmedBy?: string | null;
  source: "WHATSAPP_BUTTON" | "WEB_LINK" | "CRM_MANUAL";
  sendWhatsAppAck?: boolean;
  replyPhone?: string | null;
  conversationId?: string | null;
}) {
  const claim = await prisma.accidentClaim.findUnique({
    where: { id: opts.claimId },
    include: {
      vehicle: true,
      driver: true,
    },
  });

  if (!claim) {
    return {
      success: false,
      error: "Dossier accident introuvable",
      alreadyConfirmed: false,
      claim: null,
    };
  }

  const resolvedManager = resolveFleetManagerContactForVehicle(claim.vehicle || {});
  const existingMeta = extractFleetSyncFromComments(claim.comments);
  const confirmedByName =
    opts.confirmedBy?.trim() ||
    existingMeta.fleet_manager_name ||
    resolvedManager.name;

  if (existingMeta.fleet_created_on_gocab_fleet) {
    if (opts.sendWhatsAppAck && (opts.replyPhone || existingMeta.fleet_manager_phone)) {
      try {
        const { sendOutboundWhatsAppMessage } = await import("./whatsappApiService");
        await sendOutboundWhatsAppMessage({
          conversationId: opts.conversationId || undefined,
          phoneNumber: opts.replyPhone || existingMeta.fleet_manager_phone || resolvedManager.phone,
          senderName: "GoCab Assurance CRM",
          text:
            `✅ *Déjà enregistré :* Le dossier accident du véhicule *${claim.vehicle?.plate_number || ""}* ` +
            `est déjà marqué comme *Créé sur GoCab Fleet* (confirmé par ${existingMeta.fleet_created_by || confirmedByName}).`,
        });
      } catch {}
    }

    return {
      success: true,
      alreadyConfirmed: true,
      claim,
      meta: existingMeta,
    };
  }

  const nowIso = new Date().toISOString();
  const sourceLabel =
    opts.source === "WHATSAPP_BUTTON"
      ? "via bouton WhatsApp"
      : opts.source === "WEB_LINK"
      ? "via lien de validation WhatsApp"
      : "depuis le CRM";

  const updatedComments = mergeFleetSyncIntoComments(
    claim.comments,
    {
      fleet_manager_key: existingMeta.fleet_manager_key || resolvedManager.key,
      fleet_manager_name: existingMeta.fleet_manager_name || resolvedManager.name,
      fleet_manager_phone: existingMeta.fleet_manager_phone || resolvedManager.phone,
      fleet_created_on_gocab_fleet: true,
      fleet_created_at: nowIso,
      fleet_created_by: confirmedByName,
      fleet_created_source: opts.source,
    },
    {
      timeline_step: claim.timeline_step || "NEW_ACCIDENT",
      comment: `✅ Accident confirmé et créé sur GoCab Fleet par ${confirmedByName} (${sourceLabel}).`,
      author: confirmedByName,
    },
    (claim.vehicle as any)?.insurance_policy_number
  );

  const updatedClaim = await prisma.accidentClaim.update({
    where: { id: opts.claimId },
    data: { comments: updatedComments },
    include: {
      vehicle: true,
      driver: {
        include: {
          accidentClaims: true,
        },
      },
    },
  });

  await touchSyncState("tickets").catch(() => {});
  await touchSyncState("all").catch(() => {});
  await flushDatabaseSync().catch(() => {});

  if (opts.sendWhatsAppAck && (opts.replyPhone || existingMeta.fleet_manager_phone)) {
    try {
      const { sendOutboundWhatsAppMessage } = await import("./whatsappApiService");
      await sendOutboundWhatsAppMessage({
        conversationId: opts.conversationId || undefined,
        phoneNumber: opts.replyPhone || existingMeta.fleet_manager_phone || resolvedManager.phone,
        senderName: "GoCab Assurance CRM",
        text:
          `✅ Merci *${confirmedByName}* ! L'accident du véhicule *${claim.vehicle?.plate_number || ""}* ` +
          `apparaît maintenant comme *Créé sur GoCab Fleet* sur le dossier CRM.`,
      });
    } catch (ackErr) {
      console.warn("Could not send WhatsApp confirmation ack:", ackErr);
    }
  }

  return {
    success: true,
    alreadyConfirmed: false,
    claim: updatedClaim,
    meta: extractFleetSyncFromComments(updatedClaim.comments),
  };
}
