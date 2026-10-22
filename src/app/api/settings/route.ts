/**
 * Settings API Route — GET & POST /api/settings
 * 
 * Manages system settings in the SQLite database, such as custom
 * WhatsApp message templates.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { DEFAULT_TARGET_HISTORY, parseTargetHistory } from "@/lib/target-history";

const DEFAULT_SETTINGS: Record<string, string> = {
  whatsapp_invite_template:
    "السلام عليكم {name}،\nتم تأكيد موعد التدريب الخاص بكم يوم {date} على الساعة {time}.\nنتطلع للقائكم في GoCab.\nشكراً لكم.",
  whatsapp_missing_docs_template:
    "السلام عليكم {name}،\nيرجى إرسال الوثائق التالية لاستكمال ملفكم:\n{missing_docs}\nشكراً لكم.",
  whatsapp_payment_reminder_template:
    "السلام عليكم {name}،\nنذكركم بأن عليكم متأخرات بقيمة {amount} درهم (بدون دفع منذ {days_unpaid} أيام). المرجو تسوية وضعيتكم في أقرب وقت لتفادي توقيف السيارة.\nشكراً.",
  whatsapp_block_warning_template:
    "إنذار عاجل 🚨\nالسلام عليكم {name}، نظراً لعدم تسديدكم المتأخرات بقيمة {amount} درهم، سيتم توقيف سيارتكم اليوم. المرجو الدفع فوراً.",
  telegram_bot_token: "",
  telegram_chat_id: "",
  telegram_notifications_enabled: "true",
  bc_default_issuer: JSON.stringify({
    issuer_name: "GoCab Rent",
    issuer_address: "84 Rue Ibnou Mounir, Centre Andalucia",
    issuer_city: "Maarif – Casablanca",
    issuer_legal: "RC : 707687 / Patente : 35707832 / IF : 70997186",
    issuer_phone: "0662 70 91 79",
  }),
  role_tab_permissions: JSON.stringify({
    LEAD_ACQUISITION_JR: ["dashboard", "leads"],
    ONBOARDING_SPECIALIST: ["dashboard", "training"],
    FLEET_PERF_MANAGER: ["dashboard", "fleet", "tickets", "performance"],
    FIELD_SUPERVISOR: ["dashboard", "fleet", "field", "tickets"],
    FINANCE_OFFICER: ["dashboard", "performance", "insurance"],
    OPS_MANAGER: ["dashboard", "leads", "training", "fleet", "tickets", "performance", "field", "insurance", "settings"],
    ADMIN: ["dashboard", "leads", "training", "fleet", "tickets", "performance", "field", "insurance", "settings"],
  }),
  department_weekly_targets: JSON.stringify({
    target_daily_calls: 133,
    target_daily_training_fixed: 40,
    target_weekly_leads: 250,
    target_daily_preorders: 10,
    target_daily_attended: 26,
    target_training_showup_rate: 65,
    target_kyc_completion_rate: 10,
    target_lead_conversion_rate: 30,
    target_preorder_conversion_rate: 25,
    target_active_fleet_rate: 95,
    target_max_downtime_days: 7,
    target_weekly_churn_limit: 2,
    target_max_waived_days: 10,
    target_monthly_inspection_rate: 90,
    target_gps_connectivity_rate: 100,
    target_asset_recovery_rate: 100,
    target_sla_resolution_rate: 95,
    target_max_open_tickets: 5,
    target_collection_rate: 90,
    target_weekly_revenue_mad: 50000,
  }),
  department_target_history: JSON.stringify(DEFAULT_TARGET_HISTORY),
};

import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const user = authResult.user;

    const settings = await prisma.setting.findMany();
    const settingsMap = { ...DEFAULT_SETTINGS };

    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    // SECURITY: Mask sensitive bot token for non-management roles
    const isManager = user.role === "ADMIN" || user.role === "OPS_MANAGER";
    if (!isManager && settingsMap.telegram_bot_token) {
      settingsMap.telegram_bot_token = "••••••••";
    }

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
    const authResult = await requireAuth(["ADMIN", "OPS_MANAGER"]);
    if ("error" in authResult) {
      return authResult.error;
    }

    const body = await request.json().catch(() => ({}));
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

    // If updating department_weekly_targets, update or append to date-effective department_target_history
    if (key === "department_weekly_targets") {
      try {
        const parsedTargets = typeof value === "string" ? JSON.parse(value) : value;
        const effectiveDate = body.effective_date || new Date().toISOString().split("T")[0];

        const historyRecord = await prisma.setting.findUnique({
          where: { key: "department_target_history" },
        });
        const historyList = parseTargetHistory(historyRecord?.value);

        const existingIdx = historyList.findIndex((item) => item.effective_date === effectiveDate);
        const snapshot = {
          effective_date: effectiveDate,
          target_daily_calls: Number(parsedTargets.target_daily_calls) || 50,
          target_daily_training_fixed: Number(parsedTargets.target_daily_training_fixed) || 15,
          target_daily_attended: Number(parsedTargets.target_daily_attended) || 10,
          target_daily_preorders: Number(parsedTargets.target_daily_preorders) || 4,
          target_daily_tasks: Number(parsedTargets.target_daily_tasks) || 10,
          target_lead_conversion_rate: Number(parsedTargets.target_lead_conversion_rate) || 30,
          target_training_showup_rate: Number(parsedTargets.target_training_showup_rate) || 65,
          target_preorder_conversion_rate: Number(parsedTargets.target_preorder_conversion_rate) || 25,
          ...parsedTargets,
        };

        if (existingIdx >= 0) {
          historyList[existingIdx] = snapshot;
        } else {
          historyList.push(snapshot);
        }

        historyList.sort((a, b) => a.effective_date.localeCompare(b.effective_date));

        await prisma.setting.upsert({
          where: { key: "department_target_history" },
          update: { value: JSON.stringify(historyList) },
          create: { key: "department_target_history", value: JSON.stringify(historyList) },
        });
      } catch (err) {
        console.warn("Failed to update department_target_history:", err);
      }
    }

    // Touch sync state so all open sessions refresh immediately
    touchSyncState("settings").catch(() => {});

    return NextResponse.json({ setting });
  } catch (error) {
    console.error("Error saving setting:", error);
    return NextResponse.json(
      { error: "Failed to save setting" },
      { status: 500 }
    );
  }
}
