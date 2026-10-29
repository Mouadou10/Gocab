import { NextRequest, NextResponse } from "next/server";
import {
  getBackupStatus,
  triggerBackup,
  generateBackupPayload,
  WEBHOOK_SETTING_KEY,
} from "@/lib/services/googleDriveBackup";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getBackupStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("Error getting backup status:", err);
    return NextResponse.json(
      { error: "Failed to get backup status", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync";

    if (action === "save-webhook") {
      const webhookUrl = (body.webhookUrl || "").trim();
      await prisma.setting.upsert({
        where: { key: WEBHOOK_SETTING_KEY },
        create: { key: WEBHOOK_SETTING_KEY, value: webhookUrl },
        update: { value: webhookUrl },
      });
      return NextResponse.json({ success: true, webhookUrl });
    }

    if (action === "export-json") {
      const payload = await generateBackupPayload();
      const latestJsonFile = payload.files.find((f) => f.filename === "gocab_snapshot_latest.json");
      const dateStr = new Date().toISOString().split("T")[0];
      return new NextResponse(latestJsonFile?.content || "{}", {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="gocab_backup_${dateStr}.json"`,
        },
      });
    }

    if (action === "export-csv") {
      const type = body.type || "leads";
      const payload = await generateBackupPayload();
      const file = payload.files.find((f) => f.filename === `${type}_latest.csv`);
      const dateStr = new Date().toISOString().split("T")[0];
      return new NextResponse(file?.content || "", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gocab_${type}_${dateStr}.csv"`,
        },
      });
    }

    // Default action: trigger backup
    const result = await triggerBackup();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Error triggering backup:", err);
    return NextResponse.json(
      { error: "Failed to execute backup", details: err.message },
      { status: 500 }
    );
  }
}
