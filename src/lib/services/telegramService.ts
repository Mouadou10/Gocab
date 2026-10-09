import { prisma } from "../prisma";

/**
 * Helper to fetch Telegram configuration from database settings or environment variables
 */
async function getTelegramConfig() {
  let botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  let chatId = process.env.TELEGRAM_CHAT_ID || "";
  let isEnabled = true;

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ["telegram_bot_token", "telegram_chat_id", "telegram_notifications_enabled"],
        },
      },
    });

    for (const s of settings) {
      if (s.key === "telegram_bot_token" && s.value) botToken = s.value;
      if (s.key === "telegram_chat_id" && s.value) chatId = s.value;
      if (s.key === "telegram_notifications_enabled") isEnabled = s.value !== "false";
    }
  } catch (error) {
    console.error("Error fetching Telegram settings:", error);
  }

  return { botToken, chatId, isEnabled };
}

/**
 * Sends a generic message to the configured Telegram chat/group
 */
export async function sendTelegramMessage(text: string, customToken?: string, customChatId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getTelegramConfig();
    const token = customToken || config.botToken;
    const chatId = customChatId || config.chatId;

    if (!token || !chatId) {
      return { success: false, error: "Token du bot ou Chat ID non configuré." };
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return { success: false, error: data.description || "Erreur Telegram API." };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Telegram send error:", error);
    return { success: false, error: error.message || "Erreur réseau Telegram." };
  }
}

/**
 * Sends a rich field task notification to the Telegram group
 */
export async function sendFieldTaskTelegramAlert(task: {
  id?: string;
  task_type: string;
  plate_number?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  description: string;
  priority?: string;
  triggered_by?: string | null;
}): Promise<void> {
  try {
    const config = await getTelegramConfig();
    if (!config.isEnabled || !config.botToken || !config.chatId) {
      return;
    }

    const isRecovery = task.task_type === "VEHICLE_RECOVERY";
    const headerEmoji = isRecovery ? "🚨" : task.task_type === "MONTHLY_CHECKUP" ? "🔍" : "🔧";
    const typeLabel = isRecovery
      ? "RÉCUPÉRATION VÉHICULE (Vehicle Recovery)"
      : task.task_type === "MONTHLY_CHECKUP"
      ? "CONTRÔLE MENSUEL"
      : task.task_type === "GARAGE_PICKUP"
      ? "REPRISE GARAGE"
      : task.task_type;

    const message = [
      `${headerEmoji} <b>NOUVELLE MISSION TERRAIN</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 <b>Type :</b> ${typeLabel}`,
      `🚗 <b>Véhicule :</b> <code>${task.plate_number || "Non assigné"}</code>`,
      `👤 <b>Chauffeur :</b> <b>${task.driver_name || "Non spécifié"}</b>`,
      task.driver_phone ? `📞 <b>Téléphone :</b> <a href="tel:${task.driver_phone}">${task.driver_phone}</a>` : null,
      task.triggered_by ? `👮 <b>Déclenché par :</b> <b>${task.triggered_by}</b>` : null,
      `⚠️ <b>Priorité :</b> ${task.priority === "Critical" ? "🔴 Critique" : task.priority === "Urgent" ? "🟠 Urgent" : "🟡 Normal"}`,
      `\n📝 <b>Détails de la mission :</b>`,
      `<i>${task.description}</i>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🕒 <i>${new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</i>`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message);
  } catch (err) {
    console.error("Failed to send field task Telegram alert:", err);
  }
}

/**
 * Sends a Telegram alert when a field task / vehicle recovery mission is cancelled
 */
export async function sendFieldTaskCancelledTelegramAlert(task: {
  plate_number?: string | null;
  driver_name?: string | null;
  cancelled_by?: string | null;
  reason?: string | null;
}): Promise<void> {
  try {
    const config = await getTelegramConfig();
    if (!config.isEnabled || !config.botToken || !config.chatId) {
      return;
    }

    const message = [
      `🚫 <b>MISSION ANNULÉE : RÉCUPÉRATION VÉHICULE</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🚗 <b>Véhicule :</b> <code>${task.plate_number || "Non assigné"}</code>`,
      task.driver_name ? `👤 <b>Chauffeur :</b> <b>${task.driver_name}</b>` : null,
      task.cancelled_by ? `👮 <b>Annulée par :</b> <b>${task.cancelled_by}</b>` : null,
      task.reason ? `📝 <b>Motif :</b> <i>${task.reason}</i>` : `ℹ️ <i>La mission a été annulée depuis le support / terrain. Ne pas intervenir.</i>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🕒 <i>${new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</i>`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message);
  } catch (err) {
    console.error("Failed to send field task cancelled Telegram alert:", err);
  }
}

/**
 * Sends a Telegram alert when a vehicle issue/incident is transferred to the Field Supervisor
 */
export async function sendVehicleIssueTelegramAlert(issue: {
  plate_number: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  category: string;
  title: string;
  description: string;
  priority: string;
  reported_by?: string | null;
  assigned_to?: string | null;
}): Promise<void> {
  try {
    const config = await getTelegramConfig();
    if (!config.isEnabled || !config.botToken || !config.chatId) {
      return;
    }

    const priorityBadge =
      issue.priority === "Critical"
        ? "🔴 CRITIQUE"
        : issue.priority === "Urgent"
        ? "🟠 URGENT"
        : "🟡 NORMAL";

    const message = [
      `🚨 <b>SIGNALEMENT VÉHICULE — INTERVENTION TERRAIN REQUISE</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🚗 <b>Véhicule :</b> <code>${issue.plate_number}</code>`,
      issue.driver_name ? `👤 <b>Chauffeur :</b> <b>${issue.driver_name}</b>` : null,
      issue.driver_phone ? `📞 <b>Téléphone :</b> <a href="tel:${issue.driver_phone}">${issue.driver_phone}</a>` : null,
      `🏷️ <b>Catégorie :</b> <b>${issue.category}</b>`,
      `⚠️ <b>Priorité :</b> ${priorityBadge}`,
      issue.assigned_to ? `👨‍💼 <b>Pris en charge par :</b> <b>${issue.assigned_to}</b> (Fleet Performance)` : null,
      issue.reported_by ? `📣 <b>Signalé par :</b> ${issue.reported_by}` : null,
      `\n📝 <b>Description du problème :</b>`,
      `<b>${issue.title}</b>`,
      `<i>${issue.description}</i>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👉 <i>À traiter par le Superviseur Terrain dans l'Agenda / File Terrain.</i>`,
      `🕒 <i>${new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</i>`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message);
  } catch (err) {
    console.error("Failed to send vehicle issue Telegram alert:", err);
  }
}

/**
 * Sends a rich Telegram alert when a repaired vehicle is READY FOR PICKUP at the garage (Stage 5)
 */
export async function sendCarReadyTelegramAlert(data: {
  plate_number: string;
  make_model?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  garage_name?: string | null;
  downtime_days?: number;
  triggered_by?: string | null;
  notes?: string | null;
}): Promise<void> {
  try {
    const config = await getTelegramConfig();
    if (!config.isEnabled || !config.botToken || !config.chatId) {
      return;
    }

    const message = [
      `🚗 <b>VÉHICULE PRÊT POUR RÉCUPÉRATION (GARAGE)</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🚗 <b>Véhicule :</b> <code>${data.plate_number}</code>${data.make_model ? ` (${data.make_model})` : ""}`,
      `🏬 <b>Statut :</b> <b>Prêt Récupération (Réparation terminée)</b>`,
      data.garage_name ? `🏢 <b>Garage / Atelier :</b> <b>${data.garage_name}</b>` : null,
      `👤 <b>Chauffeur :</b> <b>${data.driver_name || "Non assigné"}</b>`,
      data.driver_phone ? `📞 <b>Téléphone :</b> <a href="tel:${data.driver_phone}">${data.driver_phone}</a>` : null,
      data.downtime_days !== undefined && data.downtime_days > 0 ? `⏱️ <b>Immobilisation :</b> ${data.downtime_days} jour(s)` : null,
      data.triggered_by ? `👮 <b>Déclenché par :</b> <b>${data.triggered_by}</b>` : null,
      `⚠️ <b>Priorité :</b> 🟠 <b>URGENT</b>`,
      `\n📝 <b>Consignes de convoyage :</b>`,
      `<i>${data.notes || "Le véhicule a été réparé et est prêt au garage. Mission de convoyage et réintégration en flotte requise par le Superviseur Terrain."}</i>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👉 <i>Tâche 'Reprise Garage' ajoutée automatiquement dans l'Agenda & File Terrain.</i>`,
      `🕒 <i>${new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</i>`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message);
  } catch (err) {
    console.error("Failed to send car ready Telegram alert:", err);
  }
}

/**
 * Sends a rich Telegram alert when an intervention / mission is dispatched from the Assurance page
 */
export async function sendInsuranceMissionTelegramAlert(mission: {
  task_type: string;
  plate_number: string;
  make_model?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  priority: string;
  timeline_step_label?: string | null;
  description: string;
  author?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}): Promise<void> {
  try {
    const config = await getTelegramConfig();
    if (!config.isEnabled || !config.botToken || !config.chatId) {
      return;
    }

    const typeEmoji =
      mission.task_type === "GARAGE_PICKUP"
        ? "🔧"
        : mission.task_type === "VEHICLE_RECOVERY"
        ? "🚨"
        : "🚗";

    const typeLabel =
      mission.task_type === "GARAGE_PICKUP"
        ? "REPRISE AU GARAGE (Véhicule Réparé)"
        : mission.task_type === "VEHICLE_RECOVERY"
        ? "RÉCUPÉRATION VÉHICULE (Sinistre / Immobilisé)"
        : "VISITE / CONSTAT TERRAIN (Expertise)";

    const priorityBadge =
      mission.priority === "Critical"
        ? "🔴 CRITIQUE"
        : mission.priority === "Urgent"
        ? "🟠 URGENT"
        : "🟡 NORMAL";

    const message = [
      `${typeEmoji} <b>NOUVELLE MISSION TERRAIN — DOSSIER ASSURANCE</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 <b>Type d'intervention :</b> <b>${typeLabel}</b>`,
      `🚗 <b>Véhicule :</b> <code>${mission.plate_number}</code>${mission.make_model ? ` (${mission.make_model})` : ""}`,
      mission.timeline_step_label ? `📌 <b>Étape Sinistre :</b> ${mission.timeline_step_label}` : null,
      `👤 <b>Chauffeur :</b> <b>${mission.driver_name || "Non assigné"}</b>`,
      mission.driver_phone ? `📞 <b>Téléphone :</b> <a href="tel:${mission.driver_phone}">${mission.driver_phone}</a>` : null,
      `⚠️ <b>Priorité :</b> ${priorityBadge}`,
      mission.scheduled_date ? `📅 <b>Date prévue :</b> <b>${mission.scheduled_date} ${mission.scheduled_time || ""}</b>` : null,
      mission.author ? `👮 <b>Transmis par :</b> <b>${mission.author}</b> (Assurance & Flotte)` : null,
      `\n📝 <b>Instructions pour le Superviseur Terrain :</b>`,
      `<i>${mission.description}</i>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👉 <i>Visible dans l'Agenda & la File Terrain du Superviseur.</i>`,
      `🕒 <i>${new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</i>`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage(message);
  } catch (err) {
    console.error("Failed to send insurance mission Telegram alert:", err);
  }
}


