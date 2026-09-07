import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppApiConfig } from "@/lib/services/whatsappApiService";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const config = await getWhatsAppApiConfig();
    const host = req.headers.get("host") || "gocab-iota.vercel.app";
    const protocol = host.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/whatsapp/webhook`;

    return NextResponse.json({
      success: true,
      config: {
        phoneNumberId: config.phoneNumberId,
        hasAccessToken: Boolean(config.accessToken),
        accessTokenMasked: config.accessToken
          ? `${config.accessToken.slice(0, 6)}...${config.accessToken.slice(-4)}`
          : "",
        verifyToken: config.verifyToken,
        wabaId: config.wabaId,
        isLiveConfigured: config.isLiveConfigured,
        webhookUrl,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumberId, accessToken, verifyToken, wabaId } = body;

    const updates = [
      { key: "whatsapp_phone_number_id", value: phoneNumberId ?? "" },
      { key: "whatsapp_verify_token", value: verifyToken || "gocab_whatsapp_crm_token_2026" },
      { key: "whatsapp_waba_id", value: wabaId ?? "" },
    ];

    if (accessToken && accessToken.trim().length > 0 && !accessToken.includes("...")) {
      updates.push({ key: "whatsapp_access_token", value: accessToken.trim() });
    }

    for (const item of updates) {
      await prisma.setting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Configuration WhatsApp sauvegardée avec succès",
    });
  } catch (error: any) {
    console.error("Error saving WhatsApp config:", error);
    return NextResponse.json(
      { error: error.message || "Impossible de sauvegarder la configuration" },
      { status: 500 }
    );
  }
}
