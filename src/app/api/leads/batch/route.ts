import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { touchSyncState } from "@/lib/sync";
import { logManyLeadActivities } from "@/lib/activity-log";
import { invalidateLeadsCache } from "@/lib/leads-cache";

export const dynamic = "force-dynamic";

function resolveLeadTargetStatus(targetStatus: string, reminderDate?: string | null) {
  let board_column = "BRAND_PRE_FILTER";
  let brand_status: string | null = null;
  let training_status: string | null = null;

  if (targetStatus === "NEW_LEADS") {
    board_column = "NEW_LEADS";
    brand_status = null;
    training_status = null;
  } else if (targetStatus === "Training fixed") {
    board_column = "TRAINING_PIPELINE";
    brand_status = "Training fixed";
    training_status = "Scheduled";
  } else if (
    [
      "Not interested",
      "No response 1",
      "To Recall",
      "Wrong number",
      "No response 2",
      "Already a client",
    ].includes(targetStatus)
  ) {
    board_column = "BRAND_PRE_FILTER";
    brand_status = targetStatus;
  } else if (
    targetStatus === "Assign vehicle" ||
    targetStatus === "Accept offer" ||
    targetStatus === "VEHICLE_ASSIGNMENT"
  ) {
    board_column = "VEHICLE_ASSIGNMENT";
    training_status = "Assign vehicle";
  } else {
    // Training statuses: Scheduled, Attended, Attended and not interested, Pending, Refused the offer, Not attended, No response, Preorder
    board_column = "TRAINING_PIPELINE";
    training_status = targetStatus;
  }

  const isLeadsStatus = [
    "Training fixed",
    "Not interested",
    "No response 1",
    "To Recall",
    "Wrong number",
    "No response 2",
    "Already a client",
  ].includes(targetStatus);

  const updateData: any = {
    board_column,
    brand_status,
    training_status,
    updated_at: new Date(),
  };

  if (targetStatus === "NEW_LEADS") {
    updateData.status_changed_at = null;
  } else if (isLeadsStatus) {
    updateData.status_changed_at = new Date();
  }

  if (reminderDate !== undefined) {
    updateData.reminder_date = reminderDate ? new Date(reminderDate) : null;
  }

  return updateData;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const agentName = session?.user?.name || session?.user?.email || "Agent";

    const body = await request.json();
    const { leadIds, targetStatus, reminderDate } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "Veuillez sélectionner au moins un lead." },
        { status: 400 }
      );
    }

    if (!targetStatus) {
      return NextResponse.json(
        { error: "Veuillez choisir un statut cible." },
        { status: 400 }
      );
    }

    const updateData = resolveLeadTargetStatus(targetStatus, reminderDate);

    // Update all selected leads
    const result = await prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
      },
      data: updateData,
    });

    // Log activity for each updated lead
    try {
      const logEntries = leadIds.map((id: string) => ({
        lead_id: id,
        agent: agentName,
        action: "BATCH_STATUS_UPDATE",
        detail: `Statut groupé changé vers : ${targetStatus}${
          reminderDate ? ` (Date: ${reminderDate})` : ""
        }`,
      }));
      await logManyLeadActivities(logEntries);
    } catch (logErr) {
      console.warn("Batch activity logging warning:", logErr);
    }

    // Invalidate memory cache and trigger live sync
    invalidateLeadsCache();
    await touchSyncState("leads");

    return NextResponse.json({
      success: true,
      count: result.count,
      targetStatus,
      updateData,
    });
  } catch (err: any) {
    console.error("POST /api/leads/batch error:", err);
    return handleAuthError(err) || NextResponse.json(
      { error: err.message || "Erreur serveur lors de la mise à jour groupée." },
      { status: 500 }
    );
  }
}
