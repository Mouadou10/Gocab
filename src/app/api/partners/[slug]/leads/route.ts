/**
 * Partner Lead Submission API Route — POST /api/partners/[slug]/leads
 *
 * Allows an authorized partner (e.g. Zakaria) to submit a new driver lead directly.
 * Automatically tags the lead with referrer_name and campaign_source, and pushes it
 * to NEW_LEADS for the onboarding agents to process immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, flushDatabaseSync } from "@/lib/prisma";
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

    const rawName = (name && String(name).trim()) || "Chauffeur Partenaire";
    const rawPhone = (phone && String(phone).trim()) || "";

    if (!rawPhone) {
      return NextResponse.json(
        { error: "Le numéro de téléphone est obligatoire." },
        { status: 400 }
      );
    }

    // Flexible phone sanitization that never blocks arbitrary phone input
    const digitsOnly = rawPhone.replace(/\D/g, "");
    let sanitized_phone = rawPhone;

    if (rawPhone.startsWith("+")) {
      sanitized_phone = `+${digitsOnly}`;
    } else if (digitsOnly.startsWith("00")) {
      sanitized_phone = `+${digitsOnly.slice(2)}`;
    } else if (digitsOnly.startsWith("212")) {
      sanitized_phone = `+${digitsOnly}`;
    } else if (digitsOnly.startsWith("0") && digitsOnly.length >= 9) {
      sanitized_phone = `+212${digitsOnly.slice(1)}`;
    } else if (digitsOnly.length === 9) {
      sanitized_phone = `+212${digitsOnly}`;
    } else if (digitsOnly.length >= 8) {
      sanitized_phone = `+212${digitsOnly}`;
    } else if (digitsOnly.length > 0) {
      sanitized_phone = `+${digitsOnly}`;
    } else {
      sanitized_phone = `+212${Date.now().toString().slice(-9)}`;
    }

    // Check if phone already exists in GoCab database
    const existing = await prisma.lead.findUnique({
      where: { sanitized_phone },
      select: {
        id: true,
        raw_name: true,
        sanitized_phone: true,
        referrer_name: true,
        campaign_source: true,
        board_column: true,
        brand_status: true,
        training_status: true,
        preorder_amount: true,
        city: true,
        notes: true,
        is_archived: true,
      },
    });

    // NOTICE: Duplicate blocking check CANCELLED per requirements.
    // Zakaria is allowed to enter any number and any name.
    // The onboarding agent will verify eligibility and duplicates in the CRM later.
    const wasExistingInDb = Boolean(existing);
    const prevSource = existing?.campaign_source || "CRM";
    const duplicateNotice = wasExistingInDb
      ? ` [⚠️ Vérif Onboarding: Ce numéro existait déjà en base GoCab (${prevSource} / ${existing?.board_column || "NEW"}). Transmis par ${partnerName} pour vérification onboarding]`
      : "";

    const formattedNotes = [
      intention ? `[Objectif Chauffeur: ${intention}]` : null,
      notes && String(notes).trim() ? String(notes).trim() : null,
      `Apporteur d'Affaires: ${partnerName}${duplicateNotice} (Commission éligible: 150 DH dès prise de voiture ou précommande)`,
    ]
      .filter(Boolean)
      .join(" — ");

    let savedLead: any;

    if (existing) {
      // Reactivate / Update existing lead under Zakaria's portfolio without blocking
      const combinedNotes = existing.notes
        ? `${formattedNotes}\n${existing.notes}`
        : formattedNotes;

      // If lead was lost, archived, or in early qualification, bring to NEW_LEADS so onboarding agent sees it
      const shouldResetColumn =
        existing.is_archived ||
        existing.board_column === "BRAND_PRE_FILTER" ||
        existing.board_column === "NEW_LEADS" ||
        existing.brand_status === "Not interested";

      savedLead = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          raw_name: rawName,
          city: city && String(city).trim() ? String(city).trim() : (existing.city || "Casablanca"),
          campaign_source: `Apporteur - ${partnerName}`,
          referrer_name: partnerName,
          is_archived: false,
          board_column: shouldResetColumn ? "NEW_LEADS" : existing.board_column,
          brand_status: shouldResetColumn ? null : existing.brand_status,
          notes: combinedNotes,
          status_changed_at: new Date(),
        },
      });

      await prisma.leadActivityLog.create({
        data: {
          lead_id: savedLead.id,
          agent: `Partenaire (${partnerName})`,
          action: "PARTNER_LEAD_SUBMISSION",
          detail: `Chauffeur transmis par ${partnerName} (numéro réactivé/actualisé depuis GoCab ${prevSource}). Vérification à faire par l'agent onboarding.`,
        },
      }).catch(() => {});
    } else {
      // Create new lead in NEW_LEADS
      savedLead = await prisma.lead.create({
        data: {
          raw_name: rawName,
          sanitized_phone,
          city: city && String(city).trim() ? String(city).trim() : "Casablanca",
          campaign_source: `Apporteur - ${partnerName}`,
          referrer_name: partnerName,
          board_column: "NEW_LEADS",
          brand_status: null,
          training_status: null,
          notes: formattedNotes,
          handled_by: null,
        },
      });

      await prisma.leadActivityLog.create({
        data: {
          lead_id: savedLead.id,
          agent: `Partenaire (${partnerName})`,
          action: "PARTNER_LEAD_SUBMISSION",
          detail: `Nouveau chauffeur apporté par ${partnerName}. Éligible à 150 DH de commission dès prise de véhicule ou versement précommande.`,
        },
      }).catch(() => {});
    }

    // Invalidate cache and trigger real-time LiveSync for internal CRM agents
    invalidateLeadsCache();
    await touchSyncState("leads").catch(() => {});
    await flushDatabaseSync().catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Chauffeur ${savedLead.raw_name} enregistré avec succès !`,
      lead: {
        id: savedLead.id,
        name: savedLead.raw_name,
        phone: savedLead.sanitized_phone,
        city: savedLead.city,
        createdAt: savedLead.created_at.toISOString(),
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
