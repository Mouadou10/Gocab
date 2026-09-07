import { NextRequest, NextResponse } from "next/server";
import { handleInboundWhatsAppMessage } from "@/lib/services/whatsappApiService";

export const dynamic = "force-dynamic";

/**
 * Simulates an incoming WhatsApp message for testing and interactive CRM demo.
 * POST /api/whatsapp/simulate
 * Body: { fromPhone: string, contactName?: string, text: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromPhone, contactName, text } = body;

    if (!fromPhone || !text) {
      return NextResponse.json(
        { error: "fromPhone et text sont requis pour simuler un message" },
        { status: 400 }
      );
    }

    const result = await handleInboundWhatsAppMessage({
      fromPhone,
      contactName,
      text,
      waMessageId: `sim-${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      message: "Message entrant simulé avec succès",
      data: result,
    });
  } catch (error: any) {
    console.error("Error simulating inbound WhatsApp message:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la simulation du message" },
      { status: 500 }
    );
  }
}
