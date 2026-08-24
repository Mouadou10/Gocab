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
      age?: number | null;
      permis_seniority_years?: number | null;
      is_resident?: boolean | null;
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
    if (body.age !== undefined) {
      updateData.age = body.age !== null ? Number(body.age) : null;
    }
    if (body.permis_seniority_years !== undefined) {
      updateData.permis_seniority_years = body.permis_seniority_years !== null
        ? Number(body.permis_seniority_years)
        : null;
    }
    if (body.is_resident !== undefined) {
      updateData.is_resident = body.is_resident !== null ? Boolean(body.is_resident) : null;
    }

    // ── Eligibility Guardrails ──────────────────────────────────────────────
    // Hard gates enforced when advancing to Training or Vehicle Assignment.
    // Rules: Age 22+, Permis seniority 2+ years, Residents only.
    const guardedColumns = ["TRAINING_PIPELINE", "VEHICLE_ASSIGNMENT"];
    if (updateData.board_column && guardedColumns.includes(updateData.board_column)) {
      const currentLead = await prisma.lead.findUnique({ where: { id } });
      if (currentLead) {
        const age = updateData.age ?? currentLead.age;
        const seniority = updateData.permis_seniority_years ?? currentLead.permis_seniority_years;
        const isResident = updateData.is_resident ?? currentLead.is_resident;

        const violations: string[] = [];
        if (age !== null && age !== undefined && age < 22) {
          violations.push(`Age must be 22+ (current: ${age})`);
        }
        if (seniority !== null && seniority !== undefined && seniority < 2) {
          violations.push(`Permis seniority must be 2+ years (current: ${seniority} yr)`);
        }
        if (isResident === false) {
          violations.push("Non-residents are strictly blocked from the pipeline");
        }

        if (violations.length > 0) {
          return NextResponse.json(
            {
              error: "Eligibility guardrail blocked this move",
              violations,
            },
            { status: 422 }
          );
        }
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    // If the lead is being moved out of NEW_LEADS, stamp when it happened
    if (updateData.board_column && updateData.board_column !== "NEW_LEADS") {
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

    return NextResponse.json({ lead: updatedLead });
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}
