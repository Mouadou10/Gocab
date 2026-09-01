/**
 * Lead Update API Route — PATCH /api/leads/[id]
 *
 * Updates a single lead's board_column, brand_status,
 * training_status, and/or reminder_date.
 * Enforces eligibility guardrails when advancing through pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build the update payload from provided fields
    const updateData: {
      board_column?: string;
      brand_status?: string;
      training_status?: string;
      reminder_date?: Date | null;
      preorder_amount?: number | null;
      city?: string | null;
      has_cin?: boolean;
      has_fiche_anthropometrique?: boolean;
      has_confirmation_adresse?: boolean;
      has_permis?: boolean;
      notes?: string | null;
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
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    // Guardrails removed per user request
    // ───────────────────────────────────────────────────────────────────────

    // If the lead is marked as recalled or being moved out of NEW_LEADS, stamp when it happened
    if (body.is_recalled || body.mark_as_called) {
      (updateData as any).status_changed_at = new Date();
    } else if (updateData.board_column && updateData.board_column !== "NEW_LEADS") {
      const currentLead = await prisma.lead.findUnique({
        where: { id },
        select: { board_column: true, status_changed_at: true },
      });
      if (currentLead && currentLead.board_column === "NEW_LEADS") {
        (updateData as any).status_changed_at = new Date();
      }
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

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
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}
