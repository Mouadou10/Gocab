import { NextRequest, NextResponse } from "next/server";
import {
  getWhatsAppApiConfig,
  handleInboundWhatsAppMessage,
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

/**
 * Meta Cloud API Inbound Message & Status updates (POST)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Helper to process messages
    const processMessages = async (messages: any[], contactName?: string) => {
      for (const msg of messages) {
        let messageText = "";

        if (msg.type === "text" && msg.text?.body) {
          messageText = msg.text.body;
        } else if (msg.type === "image") {
          messageText = msg.image?.caption || "📷 Photo reçue";
        } else if (msg.type === "document") {
          messageText = msg.document?.caption || `📄 Document reçu (${msg.document?.filename || "fichier"})`;
        } else if (msg.type === "audio" || msg.type === "voice") {
          messageText = "🎙️ Message vocal reçu";
        } else if (msg.type === "location") {
          messageText = `📍 Position partagée: ${msg.location?.latitude}, ${msg.location?.longitude}`;
        } else if (msg.type === "interactive") {
          messageText =
            msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title ||
            "Réponse interactive";
        } else {
          messageText = `Message de type [${msg.type || "inconnu"}] reçu`;
        }

        await handleInboundWhatsAppMessage({
          fromPhone: msg.from,
          contactName: contactName,
          text: messageText,
          waMessageId: msg.id,
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

        if (waMsgId && newStatus) {
          await getDbMsg().updateMany({
            where: { wa_message_id: waMsgId },
            data: { status: newStatus },
          });
        }
      }
    };

    // Case 1: Direct 360dialog payload format
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      const contactName = body.contacts?.[0]?.profile?.name;
      await processMessages(body.messages, contactName);
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
