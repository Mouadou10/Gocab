/**
 * Partner Lead Deletion by ID API Route — DELETE /api/partners/[slug]/leads/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, flushDatabaseSync } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { invalidateLeadsCache } from "@/lib/leads-cache";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "L'identifiant du chauffeur (id) est obligatoire." },
        { status: 400 }
      );
    }

    const existing = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Dossier chauffeur introuvable." },
        { status: 404 }
      );
    }

    await prisma.leadActivityLog.deleteMany({
      where: { lead_id: id },
    }).catch(() => {});

    await prisma.lead.delete({
      where: { id },
    });

    invalidateLeadsCache();
    await touchSyncState("leads").catch(() => {});
    await flushDatabaseSync().catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Dossier de ${existing.raw_name} supprimé avec succès.`,
      deletedLeadId: id,
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/partners/[slug]/leads/[id]:", error);
    return NextResponse.json(
      { error: "Échec de la suppression du dossier", message: error?.message },
      { status: 500 }
    );
  }
}
