/**
 * Partner Dashboard API Route — GET /api/partners/[slug]
 *
 * Returns live commission metrics and driver pipeline ledger for the partner.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPartnerSummary } from "@/lib/services/partnerCommissionService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Identifiant partenaire requis" }, { status: 400 });
    }

    const summary = await getPartnerSummary(slug);

    return NextResponse.json(
      { success: true, ...summary },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in GET /api/partners/[slug]:", error);
    return NextResponse.json(
      { error: "Échec de récupération des données partenaire", message: error?.message },
      { status: 500 }
    );
  }
}
