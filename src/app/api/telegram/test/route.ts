import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/services/telegramService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { bot_token, chat_id } = body;

    const testMessage = [
      `🤖 <b>GoCab Operations — Test Notification</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ <b>Connexion réussie !</b>`,
      `Votre groupe Telegram recevra désormais automatiquement les alertes dès qu'une nouvelle mission est créée (notamment les missions <b>Vehicle Recovery</b>).`,
      `\n🕒 <i>Envoyé le ${new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</i>`,
    ].join("\n");

    const result = await sendTelegramMessage(testMessage, bot_token, chat_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Notification de test envoyée avec succès !" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 });
  }
}
