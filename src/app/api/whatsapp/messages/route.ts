import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOutboundWhatsAppMessage } from "@/lib/services/whatsappApiService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    // Fetch messages for conversation
    const messages = await prisma.whatsAppMessage.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: "asc" },
    });

    // Mark conversation unread count as read
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { unread_count: 0 },
    }).catch(() => {});

    return NextResponse.json({
      conversationId,
      messages,
      count: messages.length,
    });
  } catch (error: any) {
    console.error("GET /api/whatsapp/messages error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, phoneNumber, text, senderName } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Le texte du message est requis" }, { status: 400 });
    }

    if (!conversationId && !phoneNumber) {
      return NextResponse.json(
        { error: "Veuillez fournir conversationId ou phoneNumber" },
        { status: 400 }
      );
    }

    let phone = phoneNumber;
    if (!phone && conversationId) {
      const conv = await prisma.whatsAppConversation.findUnique({
        where: { id: conversationId },
      });
      phone = conv?.phone_number;
    }

    if (!phone) {
      return NextResponse.json({ error: "Numéro de téléphone introuvable" }, { status: 400 });
    }

    const result = await sendOutboundWhatsAppMessage({
      conversationId,
      phoneNumber: phone,
      text: text.trim(),
      senderName: senderName || "GoCab Operations",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      mode: result.mode,
      apiError: result.apiError,
    });
  } catch (error: any) {
    console.error("POST /api/whatsapp/messages error:", error);
    return NextResponse.json(
      { error: error?.message || "Échec d'envoi du message WhatsApp" },
      { status: 500 }
    );
  }
}
