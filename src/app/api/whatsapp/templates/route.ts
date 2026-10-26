import { NextRequest, NextResponse } from "next/server";
import { fetchLive360Templates } from "@/lib/services/whatsappApiService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1" || searchParams.get("refresh") === "true";
    const { templates, source } = await fetchLive360Templates(forceRefresh);

    return NextResponse.json({
      success: true,
      source,
      count: templates.length,
      templates,
    });
  } catch (error: any) {
    console.error("GET /api/whatsapp/templates error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch 360dialog templates" },
      { status: 500 }
    );
  }
}
