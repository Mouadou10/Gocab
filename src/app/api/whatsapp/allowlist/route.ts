import { NextRequest, NextResponse } from "next/server";
import {
  addPhoneTo360dialogAllowlist,
  get360dialogAllowlist,
  set360dialogAudience,
  getWhatsAppApiConfig,
} from "@/lib/services/whatsappApiService";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getWhatsAppApiConfig();
    const result = await get360dialogAllowlist();

    // Also load local backup list from DB settings
    const localAllowlistSetting = await prisma.setting.findUnique({
      where: { key: "whatsapp_allowlist" },
    });
    const localList: string[] = localAllowlistSetting?.value
      ? JSON.parse(localAllowlistSetting.value)
      : ["+212645398932"];

    // Merge lists
    const combined = Array.from(new Set([...(result.allowlist || []), ...localList]));

    return NextResponse.json({
      success: true,
      allowlist: combined,
      audience: result.audience || "ALLOWLISTED_ONLY",
      apiKeyConfigured: Boolean(config.d360ApiKey),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, audience, action } = body;

    const config = await getWhatsAppApiConfig();

    if (action === "set_audience" && audience) {
      const audienceRes = await set360dialogAudience(audience);
      return NextResponse.json({
        success: audienceRes.success,
        audience,
        response: audienceRes.response,
      });
    }

    const phoneToAdd = phoneNumber || "+212645398932";

    // 1. Call 360dialog API
    let apiResult: any = null;
    let apiError: string | null = null;

    if (config.d360ApiKey) {
      try {
        apiResult = await addPhoneTo360dialogAllowlist(phoneToAdd);
        if (!apiResult.success) {
          apiError =
            apiResult.response?.meta?.developer_message ||
            apiResult.response?.error?.message ||
            `HTTP ${apiResult.status}`;
        }
      } catch (err: any) {
        apiError = err.message;
      }
    }

    // 2. Also save to local Settings store as persistent allowlist
    const localAllowlistSetting = await prisma.setting.findUnique({
      where: { key: "whatsapp_allowlist" },
    });
    const currentList: string[] = localAllowlistSetting?.value
      ? JSON.parse(localAllowlistSetting.value)
      : [];

    if (!currentList.includes(phoneToAdd)) {
      currentList.push(phoneToAdd);
    }

    await prisma.setting.upsert({
      where: { key: "whatsapp_allowlist" },
      update: { value: JSON.stringify(currentList) },
      create: { key: "whatsapp_allowlist", value: JSON.stringify(currentList) },
    });

    return NextResponse.json({
      success: true,
      phoneNumber: phoneToAdd,
      d360Result: apiResult,
      apiError,
      message: apiError
        ? `Numéro enregistré dans le CRM. Réponse 360dialog: ${apiError}`
        : `✓ Numéro ${phoneToAdd} ajouté avec succès à la allowlist 360dialog !`,
      allowlist: currentList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
