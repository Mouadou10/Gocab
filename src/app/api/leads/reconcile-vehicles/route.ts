import { NextResponse } from "next/server";
import { reconcileAllVehicleAssignmentsWithLeads } from "@/lib/services/leadVehicleReconciliation";
import { requireAuth } from "@/lib/auth-guard";
import { touchSyncState } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/leads/reconcile-vehicles
 * Scans all active vehicles and driver assignments, matches them against
 * the Leads and Training pipeline using high-precision phone & name matching,
 * and updates any matching candidate to VEHICLE_ASSIGNMENT.
 */
export async function POST() {
  try {
    await requireAuth();
    const result = await reconcileAllVehicleAssignmentsWithLeads();
    await touchSyncState("leads");
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/leads/reconcile-vehicles error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to reconcile vehicle assignments" },
      { status: 500 }
    );
  }
}
