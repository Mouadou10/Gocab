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
        provider: config.provider,
        d360ApiKeyMasked: config.d360ApiKey
          ? `${config.d360ApiKey.slice(0, 6)}...${config.d360ApiKey.slice(-4)}`
          : "",
        hasD360ApiKey: Boolean(config.d360ApiKey),
        d360ApiUrl: config.d360ApiUrl,
        phoneNumber: config.phoneNumber,
        channelId: config.channelId,
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
    const {
      provider,
      d360ApiKey,
      d360ApiUrl,
      phoneNumber,
      channelId,
      phoneNumberId,
      accessToken,
      verifyToken,
      wabaId,
      action,
    } = body;

    // Action: Automatically register webhook with 360dialog
    if (action === "register_360dialog_webhook") {
      const config = await getWhatsAppApiConfig();
      const apiKey = d360ApiKey || config.d360ApiKey;
      const baseUrl = (d360ApiUrl || config.d360ApiUrl || "https://waba-v2.360dialog.io").replace(/\/$/, "");
      const host = req.headers.get("host") || "gocab-iota.vercel.app";
      const protocol = host.includes("localhost") ? "http" : "https";
      const webhookUrl = `${protocol}://${host}/api/whatsapp/webhook`;

      if (!apiKey) {
        return NextResponse.json({ error: "Clé API 360dialog manquante" }, { status: 400 });
      }

      try {
        const d360Res = await fetch(`${baseUrl}/v1/configs/webhook`, {
          method: "POST",
          headers: {
            "D360-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: webhookUrl }),
        });

        const d360Data = await d360Res.json().catch(() => null);
        return NextResponse.json({
          success: d360Res.ok,
          message: d360Res.ok
            ? "Webhook 360dialog enregistré avec succès !"
            : d360Data?.meta?.developer_message || "Échec d'enregistrement du webhook",
          d360Response: d360Data,
        });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Erreur réseau avec 360dialog" }, { status: 500 });
      }
    }

    const updates: { key: string; value: string }[] = [
      { key: "whatsapp_provider", value: provider || "360dialog" },
      { key: "whatsapp_360dialog_api_url", value: d360ApiUrl || "https://waba-v2.360dialog.io" },
      { key: "whatsapp_phone_number", value: phoneNumber || "+212662145109" },
      { key: "whatsapp_channel_id", value: channelId || "1317636061430129" },
      { key: "whatsapp_phone_number_id", value: phoneNumberId ?? "" },
      { key: "whatsapp_verify_token", value: verifyToken || "gocab_whatsapp_crm_token_2026" },
      { key: "whatsapp_waba_id", value: wabaId || "2092399898064944" },
    ];

    if (d360ApiKey && d360ApiKey.trim().length > 0 && !d360ApiKey.includes("...")) {
      updates.push({ key: "whatsapp_360dialog_api_key", value: d360ApiKey.trim() });
    }

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

    // Automatically register Webhook with 360dialog if a new key is provided
    let webhookRegistered = false;
    if (d360ApiKey && d360ApiKey.trim().length > 10 && !d360ApiKey.includes("...")) {
      const host = req.headers.get("host") || "gocab-iota.vercel.app";
      const protocol = host.includes("localhost") ? "http" : "https";
      const webhookUrl = `${protocol}://${host}/api/whatsapp/webhook`;
      const baseUrl = (d360ApiUrl || "https://waba-v2.360dialog.io").replace(/\/$/, "");

      try {
        const whRes = await fetch(`${baseUrl}/v1/configs/webhook`, {
          method: "POST",
          headers: {
            "D360-API-KEY": d360ApiKey.trim(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: webhookUrl }),
        });
        webhookRegistered = whRes.ok;
      } catch (err) {
        console.warn("Auto-register webhook failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: webhookRegistered
        ? "Configuration sauvegardée et Webhook 360dialog enregistré automatiquement avec succès !"
        : "Configuration WhatsApp sauvegardée avec succès",
      webhookRegistered,
    });
  } catch (error: any) {
    console.error("Error saving WhatsApp config:", error);
    return NextResponse.json(
      { error: error.message || "Impossible de sauvegarder la configuration" },
      { status: 500 }
    );
  }
}
