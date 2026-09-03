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
