/**
 * Automated WhatsApp Lead Invitation API
 * POST /api/leads/[id]/send-invite
 *
 * Dispatches official WhatsApp 360dialog template invitation directly via API
 * (Rabat / Casablanca / Vendredi location and timing templates)
 * without opening any new tab/window, records activity log, marks invite sent,
 * and broadcasts sync update across all open dashboards.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { touchSyncState } from "@/lib/sync";
import { invalidateLeadsCache } from "@/lib/leads-cache";
import { matchNationalBlacklist } from "@/lib/services/nationalBlacklistMatcher";
import { sendAutomatedTrainingInvitationWhatsApp } from "@/lib/services/whatsappApiService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Candidat introuvable dans le pipeline" },
        { status: 404 }
      );
    }

    if (!lead.sanitized_phone) {
      return NextResponse.json(
        { error: "Numéro de téléphone manquant pour ce candidat" },
        { status: 400 }
      );
    }

    const senderName = session.user?.name || session.user?.email || "GoCab Formation";

    // Use scheduled reminder date if set; fallback to today if not yet specified
    const effectiveReminderDate = lead.reminder_date || new Date();

    // Dispatch WhatsApp training invite via official 360dialog Cloud API
    const sendResult = await sendAutomatedTrainingInvitationWhatsApp(
      {
        id: lead.id,
        raw_name: lead.raw_name,
        sanitized_phone: lead.sanitized_phone,
        city: lead.city,
        campaign_source: lead.campaign_source,
        notes: lead.notes,
        reminder_date: effectiveReminderDate,
      },
      senderName
    );

    if (!sendResult.success) {
      return NextResponse.json(
        {
          error: sendResult.error || "Échec de l'envoi de la convocation WhatsApp via l'API",
        },
        { status: 400 }
      );
    }

    // Embed durable invite sent marker in lead notes and update invite timestamp
    const nowIso = new Date().toISOString();
    const marker = `[INVITE_SENT:${nowIso}]`;
    const cleanNotes = (lead.notes || "").replace(/\[INVITE_SENT:[^\]]*\]/g, "").trim();
    const updatedNotes = cleanNotes ? `${cleanNotes}\n${marker}` : marker;

    let updatedLead: any = null;
    try {
      updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          whatsapp_invite_sent: true,
          whatsapp_invite_sent_at: new Date(),
          notes: updatedNotes,
        },
      });
    } catch {
      // Graceful fallback if database column is in migration transition
      updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          notes: updatedNotes,
        },
      });
      updatedLead = {
        ...updatedLead,
        whatsapp_invite_sent: true,
        whatsapp_invite_sent_at: nowIso,
      };
    }

    // Invalidate memory cache and trigger live sync
    invalidateLeadsCache();
    await touchSyncState("leads").catch(() => {});

    const nationalMatch = matchNationalBlacklist(updatedLead.raw_name);

    return NextResponse.json({
      success: true,
      message: `Convocation officielle ("${sendResult.templateName}") transmise avec succès via l'API WhatsApp`,
      templateName: sendResult.templateName,
      messageId: sendResult.messageId,
      deliveryMode: sendResult.deliveryMode,
      lead: {
        ...updatedLead,
        whatsapp_invite_sent: true,
        whatsapp_invite_sent_at: updatedLead.whatsapp_invite_sent_at || nowIso,
        national_blacklist_match: nationalMatch.isBlacklisted ? nationalMatch : null,
      },
    });
  } catch (error) {
    console.error("Error in /api/leads/[id]/send-invite:", error);
    try {
      return handleAuthError(error);
    } catch {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erreur interne lors de l'envoi de la convocation" },
        { status: 500 }
      );
    }
  }
}
