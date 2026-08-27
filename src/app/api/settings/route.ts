/**
 * Settings API Route — GET & POST /api/settings
 * 
 * Manages system settings in the SQLite database, such as custom
 * WhatsApp message templates.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS: Record<string, string> = {
  whatsapp_invite_template:
    "السلام عليكم {name}،\nتم تأكيد موعد التدريب الخاص بكم يوم {date} على الساعة {time}.\nنتطلع للقائكم في GoCab.\nشكراً لكم.",
  whatsapp_missing_docs_template:
    "السلام عليكم {name}،\nيرجى إرسال الوثائق التالية لاستكمال ملفكم:\n{missing_docs}\nشكراً لكم.",
  whatsapp_payment_reminder_template:
    "السلام عليكم {name}،\nنذكركم بأن عليكم متأخرات بقيمة {amount} درهم (بدون دفع منذ {days_unpaid} أيام). المرجو تسوية وضعيتكم في أقرب وقت لتفادي توقيف السيارة.\nشكراً.",
  whatsapp_block_warning_template:
    "إنذار عاجل 🚨\nالسلام عليكم {name}، نظراً لعدم تسديدكم المتأخرات بقيمة {amount} درهم، سيتم توقيف سيارتكم اليوم. المرجو الدفع فوراً.",
  role_tab_permissions: JSON.stringify({
    LEAD_ACQUISITION_JR: ["dashboard", "leads", "training"],
    FLEET_PERF_MANAGER: ["dashboard", "fleet", "tickets", "performance"],
    FIELD_SUPERVISOR: ["dashboard", "fleet", "field", "tickets"],
    FINANCE_OFFICER: ["dashboard", "performance", "insurance"],
    OPS_MANAGER: ["dashboard", "leads", "training", "fleet", "tickets", "performance", "field", "insurance", "settings"],
    ADMIN: ["dashboard", "leads", "training", "fleet", "tickets", "performance", "field", "insurance", "settings"],
  }),
};

export async function GET() {
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap = { ...DEFAULT_SETTINGS };

    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Missing key or value" },
        { status: 400 }
      );
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json({ setting });
  } catch (error) {
    console.error("Error saving setting:", error);
    return NextResponse.json(
      { error: "Failed to save setting" },
      { status: 500 }
    );
  }
}
