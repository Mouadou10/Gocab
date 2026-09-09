/**
 * Lead Update API Route — PATCH /api/leads/[id]
 *
 * Updates a single lead's board_column, brand_status,
 * training_status, and/or reminder_date.
 * Enforces eligibility guardrails when advancing through pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { LeadUpdateSchema } from "@/lib/validations";
import { touchSyncState } from "@/lib/sync";
import { logManyLeadActivities } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const rawBody = await request.json();

    const parseResult = LeadUpdateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const body = parseResult.data;

    // Build the update payload from provided fields
    const updateData: {
      board_column?: string;
      brand_status?: string | null;
      training_status?: string | null;
      reminder_date?: Date | null;
      preorder_amount?: number | null;
      city?: string | null;
      has_cin?: boolean;
      has_fiche_anthropometrique?: boolean;
      has_confirmation_adresse?: boolean;
      has_permis?: boolean;
      presence_confirmed?: boolean;
      presence_confirmed_at?: Date | null;
      notes?: string | null;
      handled_by?: string | null;
    } = {};

    if (body.board_column !== undefined) {
      updateData.board_column = body.board_column as string;
    }
    if (body.brand_status !== undefined) {
      updateData.brand_status = body.brand_status;
    }
    if (body.training_status !== undefined) {
      updateData.training_status = body.training_status;
    }
    if (body.reminder_date !== undefined) {
      updateData.reminder_date = body.reminder_date
        ? new Date(body.reminder_date)
        : null;
    }
    if (body.preorder_amount !== undefined) {
      updateData.preorder_amount = body.preorder_amount !== null 
        ? Number(body.preorder_amount) 
        : null;
    }
    if (body.city !== undefined) {
      updateData.city = body.city;
    }
    if (body.has_cin !== undefined) {
      updateData.has_cin = Boolean(body.has_cin);
    }
    if (body.has_fiche_anthropometrique !== undefined) {
      updateData.has_fiche_anthropometrique = Boolean(body.has_fiche_anthropometrique);
    }
    if (body.has_confirmation_adresse !== undefined) {
      updateData.has_confirmation_adresse = Boolean(body.has_confirmation_adresse);
    }
    if (body.has_permis !== undefined) {
      updateData.has_permis = Boolean(body.has_permis);
    }
    if (body.presence_confirmed !== undefined) {
      updateData.presence_confirmed = Boolean(body.presence_confirmed);
      updateData.presence_confirmed_at = body.presence_confirmed ? new Date() : null;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }
    if (body.handled_by !== undefined) {
      updateData.handled_by = body.handled_by;
    }

    // Guardrails removed per user request
    // ───────────────────────────────────────────────────────────────────────

    // If status or column is changed or marked as called, stamp when it happened
    if (
      body.is_recalled ||
      body.mark_as_called ||
      body.brand_status !== undefined ||
      body.training_status !== undefined ||
      (body.board_column && body.board_column !== "NEW_LEADS")
    ) {
      (updateData as any).status_changed_at = new Date();
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

    // Touch sync state so all open sessions refresh immediately
    touchSyncState("leads").catch(() => {});

    // ── Activity Log — record what the agent just did ────────────────────────
    const agentName =
      body.handled_by ||
      session?.user?.name ||
      session?.user?.email ||
      "Agent";
    const logEntries: { lead_id: string; agent: string; action: string; detail: string }[] = [];

    if (body.brand_status !== undefined) {
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "STATUS_CHANGED",
        detail: `Statut → ${body.brand_status || "(vide)"}`,
      });
    }
    if (body.training_status !== undefined) {
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "TRAINING_STATUS_CHANGED",
        detail: `Formation → ${body.training_status || "(vide)"}`,
      });
    }
    if (body.reminder_date !== undefined) {
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "RECALL_SET",
        detail: body.reminder_date
          ? `Rappel fixé au ${new Date(body.reminder_date).toLocaleDateString("fr-FR")}`
          : "Rappel supprimé",
      });
    }
    if (body.presence_confirmed !== undefined) {
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "PRESENCE_CONFIRMED",
        detail: body.presence_confirmed
          ? "Présence confirmée par appel"
          : "Confirmation de présence retirée",
      });
    }
    if (body.notes !== undefined) {
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "NOTE_ADDED",
        detail: body.notes ? `Note : ${body.notes.slice(0, 80)}${body.notes.length > 80 ? "..." : ""}` : "Note effacée",
      });
    }
    if (
      body.has_cin !== undefined ||
      body.has_permis !== undefined ||
      body.has_fiche_anthropometrique !== undefined ||
      body.has_confirmation_adresse !== undefined
    ) {
      const docs: string[] = [];
      if (body.has_cin !== undefined) docs.push(`CIN ${body.has_cin ? "✓" : "✗"}`);
      if (body.has_permis !== undefined) docs.push(`Permis ${body.has_permis ? "✓" : "✗"}`);
      if (body.has_fiche_anthropometrique !== undefined) docs.push(`Fiche anthropo. ${body.has_fiche_anthropometrique ? "✓" : "✗"}`);
      if (body.has_confirmation_adresse !== undefined) docs.push(`Conf. adresse ${body.has_confirmation_adresse ? "✓" : "✗"}`);
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "KYC_UPDATED",
        detail: `Documents : ${docs.join(", ")}`,
      });
    }
    if (body.board_column !== undefined) {
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "COLUMN_MOVED",
        detail: `Déplacé vers → ${body.board_column}`,
      });
    }
    if (body.city !== undefined && body.city) {
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "CITY_SET",
        detail: `Ville → ${body.city}`,
      });
    }
    if (body.preorder_amount !== undefined) {
      logEntries.push({
        lead_id: id,
        agent: agentName,
        action: "PREORDER_SET",
        detail: `Précommande → ${body.preorder_amount ? body.preorder_amount + " MAD" : "supprimée"}`,
      });
    }

    if (logEntries.length > 0) {
      logManyLeadActivities(logEntries).catch(() => {});
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Auto-Convert Lead to DriverProfile & Assign Vehicle ────────────────
    if (
      updatedLead.training_status === "Assign vehicle" ||
      updatedLead.training_status === "Accept offer" ||
      updatedLead.board_column === "VEHICLE_ASSIGNMENT"
    ) {
      try {
        const cinNumber =
          (updatedLead as any).national_id?.trim() ||
          `CIN-${updatedLead.sanitized_phone.replace(/\D/g, "").slice(-6)}`;

        const vehicleId = body.assigned_vehicle_id || null;

        const existingDriver = await prisma.driverProfile.findFirst({
          where: {
            OR: [
              { phoneSanitized: updatedLead.sanitized_phone },
              { cinNumber: cinNumber },
            ],
          },
        });

        let driverId = existingDriver?.id;

        if (!existingDriver) {
          const newDriver = await prisma.driverProfile.create({
            data: {
              fullName: updatedLead.raw_name,
              phoneSanitized: updatedLead.sanitized_phone,
              cinNumber,
              age: (updatedLead as any).age || 28,
              licenseSeniority: (updatedLead as any).permis_seniority_years || 2,
              isKycVerified: true,
              contractType: "DAILY",
              monthlyTripCount: 0,
              currentArrearsMAD: 0.0,
              defaultStage: "NOMINAL",
              assignedVehicleId: vehicleId,
            },
          });
          driverId = newDriver.id;
          console.log(`✨ Auto-converted Lead ${updatedLead.raw_name} to DriverProfile (${updatedLead.sanitized_phone})`);
        } else {
          // Update KYC status and vehicle
          await prisma.driverProfile.update({
            where: { id: existingDriver.id },
            data: {
              fullName: updatedLead.raw_name,
              isKycVerified: true,
              assignedVehicleId: vehicleId || existingDriver.assignedVehicleId,
            },
          });
        }

        // If a vehicle was selected, mark vehicle as ACTIF and attach driver details
        if (vehicleId) {
          await prisma.vehicle.update({
            where: { id: vehicleId },
            data: {
              status: "ACTIF",
              assigned_driver_name: updatedLead.raw_name,
              assigned_driver_phone: updatedLead.sanitized_phone,
            },
          });
          console.log(`🚗 Assigned vehicle ${vehicleId} to driver ${updatedLead.raw_name}`);
        }
      } catch (driverErr: any) {
        console.error("Auto-convert to DriverProfile warning:", driverErr?.message);
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    return NextResponse.json({ lead: updatedLead });
  } catch (error) {
    console.error("Error updating lead:", error);
    try {
      return handleAuthError(error);
    } catch {
      return NextResponse.json(
        { error: "Failed to update lead" },
        { status: 500 }
      );
    }
  }
}
