import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWhatsAppTables } from "@/lib/services/whatsappApiService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureWhatsAppTables();

    // Verify tables exist in SQLite
    const tables: any = await prisma.$queryRawUnsafe(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE '%WhatsApp%'
    `).catch(() => []);

    return NextResponse.json({
      success: true,
      message: "WhatsApp database tables synchronized successfully",
      tables,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("WhatsApp DB sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to sync WhatsApp tables",
      },
      { status: 500 }
    );
  }
}
