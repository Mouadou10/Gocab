import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import {
  confirmAccidentCreatedOnFleet,
  extractFleetSyncFromComments,
  resolveFleetManagerContactForVehicle,
  verifyFleetConfirmToken,
} from "@/lib/services/fleetAccidentNotifyService";

export const dynamic = "force-dynamic";

/**
 * GET /api/accidents/confirm-fleet?id=<claimId>&t=<hmacToken>
 * Public HMAC-verified endpoint for Fleet Managers opening the 1-click WhatsApp confirmation link.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = (searchParams.get("id") || "").trim();
    const token = (searchParams.get("t") || "").trim();

    if (!id || !verifyFleetConfirmToken(id, token)) {
      return NextResponse.json(
        { success: false, error: "Lien de confirmation invalide ou expiré." },
        { status: 403 }
      );
    }

    const claim = await prisma.accidentClaim.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: true,
      },
    });

    if (!claim) {
      return NextResponse.json(
        { success: false, error: "Dossier accident introuvable." },
        { status: 404 }
      );
    }

    const manager = resolveFleetManagerContactForVehicle(claim.vehicle || {});
    const meta = extractFleetSyncFromComments(claim.comments);

    return NextResponse.json({
      success: true,
      summary: {
        id: claim.id,
        plate_number: claim.vehicle?.plate_number || "Inconnu",
        make_model: claim.vehicle?.make_model || "Véhicule Flotte GoCab",
        hub_city: (claim.vehicle as any)?.hub_city || "Casablanca",
        driver_name: claim.driver_name || claim.driver?.fullName || "Non renseigné",
        driver_phone: claim.driver_phone || claim.driver?.phoneSanitized || null,
        timeline_step: claim.timeline_step,
        created_at: claim.created_at,
        fleet_manager_name: meta.fleet_manager_name || manager.name,
        fleet_created_on_gocab_fleet: Boolean(meta.fleet_created_on_gocab_fleet),
        fleet_created_at: meta.fleet_created_at || null,
        fleet_created_by: meta.fleet_created_by || null,
      },
    });
  } catch (error: any) {
    console.error("GET /api/accidents/confirm-fleet error:", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de la vérification du dossier." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accidents/confirm-fleet
 * Marks the accident claim as created on GoCab Fleet via signed HMAC token.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    const token = String(body.token || "").trim();
    const confirmedBy = body.confirmedBy ? String(body.confirmedBy).trim() : undefined;

    if (!id || !verifyFleetConfirmToken(id, token)) {
      return NextResponse.json(
        { success: false, error: "Jeton de sécurité invalide." },
        { status: 403 }
      );
    }

    const result = await confirmAccidentCreatedOnFleet({
      claimId: id,
      confirmedBy,
      source: "WEB_LINK",
      sendWhatsAppAck: true,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Impossible de confirmer le dossier." },
        { status: 404 }
      );
    }

    await touchSyncState("tickets").catch(() => {});
    await touchSyncState("all").catch(() => {});

    return NextResponse.json({
      success: true,
      alreadyConfirmed: result.alreadyConfirmed,
      meta: result.meta,
    });
  } catch (error: any) {
    console.error("POST /api/accidents/confirm-fleet error:", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de la confirmation." },
      { status: 500 }
    );
  }
}
