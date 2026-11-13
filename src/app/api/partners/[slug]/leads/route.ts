/**
 * Partner Lead Submission API Route — POST /api/partners/[slug]/leads
 *
 * Allows an authorized partner (e.g. Zakaria) to submit a new driver lead directly.
 * Automatically tags the lead with referrer_name and campaign_source, and pushes it
 * to NEW_LEADS for the onboarding agents to process immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { invalidateLeadsCache } from "@/lib/leads-cache";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({}));
    const { name, phone, city, notes, intention } = body;

    const partnerName = slug ? slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase() : "Zakaria";

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Le nom complet du chauffeur est obligatoire." },
        { status: 400 }
      );
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: "Le numéro de téléphone est obligatoire." },
        { status: 400 }
      );
    }

    // Sanitize Moroccan phone number
    let cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
    if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
    if (cleaned.startsWith("212")) cleaned = cleaned.slice(3);
    cleaned = cleaned.replace(/^0+/, "");

    if (cleaned.length < 8) {
      return NextResponse.json(
        { error: "Numéro de téléphone marocain invalide (Ex: 06 12 34 56 78 ou 07 ...)." },
        { status: 400 }
      );
    }

    const sanitized_phone = `+212${cleaned}`;

    // Check if phone already exists in GoCab database
    const existing = await prisma.lead.findUnique({
      where: { sanitized_phone },
      select: {
        id: true,
        raw_name: true,
        sanitized_phone: true,
        referrer_name: true,
        board_column: true,
        brand_status: true,
        training_status: true,
      },
    });

    if (existing) {
      // If already brought by this partner
      const isSamePartner = (existing.referrer_name || "").toLowerCase() === partnerName.toLowerCase();
      return NextResponse.json(
        {
          error: isSamePartner
            ? `Ce chauffeur (${sanitized_phone}) est déjà dans votre liste de suivi.`
            : `Ce chauffeur (${sanitized_phone}) existe déjà dans la base GoCab.`,
          existingLead: existing,
        },
        { status: 409 }
      );
    }

    const formattedNotes = [
      intention ? `[Objectif Chauffeur: ${intention}]` : null,
      notes ? notes.trim() : null,
      `Apporteur d'Affaires: ${partnerName} (Commission éligible: 150 DH dès prise de voiture ou précommande)`,
    ]
      .filter(Boolean)
      .join(" — ");

    // Create the lead in NEW_LEADS
    const newLead = await prisma.lead.create({
      data: {
        raw_name: name.trim(),
        sanitized_phone,
        city: city?.trim() || "Casablanca",
        campaign_source: `Apporteur - ${partnerName}`,
        referrer_name: partnerName,
        board_column: "NEW_LEADS",
        brand_status: null,
        training_status: null,
        notes: formattedNotes,
        handled_by: null,
      },
    });

    // Record audit activity log
    await prisma.leadActivityLog.create({
      data: {
        lead_id: newLead.id,
        agent: `Partenaire (${partnerName})`,
        action: "PARTNER_LEAD_SUBMISSION",
        detail: `Nouveau chauffeur apporté par ${partnerName}. Éligible à 150 DH de commission dès prise de véhicule ou versement précommande.`,
      },
    }).catch(() => {});

    // Invalidate cache and trigger real-time LiveSync for internal CRM agents
    invalidateLeadsCache();
    await touchSyncState("leads").catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Chauffeur ${newLead.raw_name} enregistré avec succès !`,
      lead: {
        id: newLead.id,
        name: newLead.raw_name,
        phone: newLead.sanitized_phone,
        city: newLead.city,
        createdAt: newLead.created_at.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/partners/[slug]/leads:", error);
    return NextResponse.json(
      { error: "Échec de l'enregistrement du chauffeur", message: error?.message },
      { status: 500 }
    );
  }
}
