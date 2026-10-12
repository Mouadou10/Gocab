import { NextRequest, NextResponse } from "next/server";
import {
  getWhatsAppApiConfig,
  handleInboundWhatsAppMessage,
  handleEchoWhatsAppMessage,
  getDbMsg,
} from "@/lib/services/whatsappApiService";

export const dynamic = "force-dynamic";

/**
 * Meta Cloud API Webhook Verification (GET)
 * Meta calls this when you configure the Webhook URL in developers.facebook.com
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const config = await getWhatsAppApiConfig();

  if (mode === "subscribe" && token === config.verifyToken) {
    console.log("✅ WhatsApp Cloud API Webhook verified successfully");
    return new NextResponse(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("❌ WhatsApp Cloud API Webhook verification failed. Token mismatch or bad mode.");
  return NextResponse.json({ error: "Forbidden: verification token mismatch" }, { status: 403 });
}

import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    // Cryptographic signature check (BUG-007)
    if (appSecret) {
      if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
        console.warn("❌ WhatsApp webhook signature missing or malformed");
        return NextResponse.json({ error: "Signature manquante ou invalide" }, { status: 401 });
      }
      const expectedHash = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      const providedHash = signatureHeader.replace("sha256=", "").trim();
      const a = crypto.createHash("sha256").update(expectedHash).digest();
      const b = crypto.createHash("sha256").update(providedHash).digest();
      if (!crypto.timingSafeEqual(a, b)) {
        console.warn("❌ WhatsApp webhook HMAC signature mismatch");
        return NextResponse.json({ error: "Signature webhook non authentifiée" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);

    const extractMessageText = (msg: any): string => {
      if (msg.type === "text" && msg.text?.body) {
        return msg.text.body;
      } else if (msg.type === "image") {
        return msg.image?.caption || "📷 Photo reçue";
      } else if (msg.type === "document") {
        return msg.document?.caption || `📄 Document reçu (${msg.document?.filename || "fichier"})`;
      } else if (msg.type === "audio" || msg.type === "voice") {
        return "🎙️ Message vocal reçu";
      } else if (msg.type === "video") {
        return msg.video?.caption || "🎥 Vidéo reçue";
      } else if (msg.type === "location") {
        return `📍 Position partagée: ${msg.location?.latitude}, ${msg.location?.longitude}`;
      } else if (msg.type === "interactive") {
        return (
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          "Réponse interactive"
        );
      } else if (msg.type === "reaction") {
        return `Réaction ${msg.reaction?.emoji || "👍"}`;
      }
      return `Message [${msg.type || "inconnu"}]`;
    };

    // Helper to process inbound messages
    const processMessages = async (messages: any[], contactName?: string) => {
      for (const msg of messages) {
        const messageText = extractMessageText(msg);
        await handleInboundWhatsAppMessage({
          fromPhone: msg.from,
          contactName: contactName,
          text: messageText,
          waMessageId: msg.id,
        });
      }
    };

    // Helper to process COEX outbound echoes from WhatsApp Business Mobile App
    const processEchoes = async (echoes: any[]) => {
      for (const echo of echoes) {
        const toPhone = echo.to;
        if (!toPhone) continue;
        const messageText = extractMessageText(echo);
        await handleEchoWhatsAppMessage({
          toPhone,
          text: messageText,
          waMessageId: echo.id,
        });
      }
    };

    // Helper to process status updates
    const processStatuses = async (statuses: any[]) => {
      for (const statusObj of statuses) {
        const waMsgId = statusObj.id;
        const rawStatus = (statusObj.status || "").toLowerCase();
        const newStatus =
          rawStatus === "read"
            ? "READ"
            : rawStatus === "delivered"
            ? "DELIVERED"
            : rawStatus === "sent"
            ? "SENT"
            : rawStatus === "failed"
            ? "FAILED"
            : statusObj.status;

        let errorMessage: string | undefined = undefined;
        if (newStatus === "FAILED" && Array.isArray(statusObj.errors) && statusObj.errors.length > 0) {
          const err = statusObj.errors[0];
          const code = err.code;
          const details = err.error_data?.details || err.message || err.title || "";
          if (code === 131047) {
            errorMessage =
              "Fenêtre 24h fermée (Code 131047) : ce contact ne vous a pas écrit durant les dernières 24h. Envoyez-lui d'abord un message depuis l'application mobile WhatsApp Business (COEX) ou attendez sa réponse.";
          } else if (code === 131026) {
            errorMessage =
              "Message non distribuable (Code 131026) : numéro non enregistré sur WhatsApp ou fenêtre de conversation inactive.";
          } else {
            errorMessage = `Erreur WhatsApp (${code || "Meta"}) : ${details}`;
          }
        }

        if (waMsgId && newStatus) {
          await getDbMsg().updateMany({
            where: { wa_message_id: waMsgId },
            data: {
              status: newStatus,
              ...(errorMessage ? { error_message: errorMessage } : {}),
            },
          });
        }
      }
    };

    // Case 1: Direct 360dialog payload format
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      const contactName = body.contacts?.[0]?.profile?.name;
      await processMessages(body.messages, contactName);
    }
    if (Array.isArray(body.message_echoes) && body.message_echoes.length > 0) {
      await processEchoes(body.message_echoes);
    }
    if (Array.isArray(body.statuses) && body.statuses.length > 0) {
      await processStatuses(body.statuses);
    }

    // Case 2: Standard Meta Cloud API nested payload format
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        if (value.messages && Array.isArray(value.messages)) {
          const contactName = value.contacts?.[0]?.profile?.name;
          await processMessages(value.messages, contactName);
        }

        if (value.message_echoes && Array.isArray(value.message_echoes)) {
          await processEchoes(value.message_echoes);
        }

        if (value.statuses && Array.isArray(value.statuses)) {
          await processStatuses(value.statuses);
        }
      }
    }

    // Always respond 200 to Meta quickly so it doesn't retry
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing WhatsApp webhook:", error);
    // Returning 200 prevents Meta from spamming retries for unparsable events
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
