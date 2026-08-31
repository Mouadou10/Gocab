/**
 * Leads API Route — GET /api/leads
 *
 * Returns all leads ordered by creation date (newest first).
 * The frontend groups them by board_column for the Kanban view.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/leads
 * Returns all leads ordered by creation date.
 */
export async function GET() {
  try {
    const now = new Date();

    // Auto-transition: Any scheduled 'To Recall' lead whose reminder_date has arrived moves back to NEW_LEADS at the top
    await prisma.lead.updateMany({
      where: {
        brand_status: "To Recall",
        reminder_date: {
          lte: now,
        },
      },
      data: {
        board_column: "NEW_LEADS",
        brand_status: null,
        updated_at: now,
      },
    });

    const leads = await prisma.lead.findMany({
      orderBy: [
        { updated_at: "desc" },
        { created_at: "desc" },
      ],
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads
 * Manually creates a new lead from the agent interface.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      city,
      campaign_source,
      age,
      permis_seniority_years,
      is_resident,
      has_cin,
      has_permis,
      has_fiche_anthropometrique,
      has_confirmation_adresse,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Le nom du prospect est requis." },
        { status: 400 }
      );
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: "Le numéro de téléphone est requis." },
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
        { error: "Format de numéro de téléphone invalide (Ex: 06 12 34 56 78)." },
        { status: 400 }
      );
    }

    const sanitized_phone = `+212${cleaned}`;

    // Check if phone already exists
    const existing = await prisma.lead.findUnique({
      where: { sanitized_phone },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Ce numéro (${sanitized_phone}) existe déjà dans la base (Prospect: ${existing.raw_name}).` },
        { status: 409 }
      );
    }

    // Check blacklist
    const isBlacklisted = await prisma.blacklist.findUnique({
      where: { sanitized_phone },
    });

    if (isBlacklisted) {
      return NextResponse.json(
        { error: `Ce numéro (${sanitized_phone}) est sur la liste noire (${isBlacklisted.reason || "Interdit"}).` },
        { status: 422 }
      );
    }

    // Create lead in NEW_LEADS column
    const lead = await prisma.lead.create({
      data: {
        raw_name: name.trim(),
        sanitized_phone,
        city: city ? city.trim() : null,
        campaign_source: campaign_source ? campaign_source.trim() : "Manual Entry",
        board_column: "NEW_LEADS",
        brand_status: null,
        training_status: null,
        age: age ? Number(age) : null,
        permis_seniority_years: permis_seniority_years ? Number(permis_seniority_years) : null,
        is_resident: is_resident !== undefined ? Boolean(is_resident) : true,
        has_cin: Boolean(has_cin),
        has_permis: Boolean(has_permis),
        has_fiche_anthropometrique: Boolean(has_fiche_anthropometrique),
        has_confirmation_adresse: Boolean(has_confirmation_adresse),
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: error.message || "Échec de la création du prospect." },
      { status: 500 }
    );
  }
}

