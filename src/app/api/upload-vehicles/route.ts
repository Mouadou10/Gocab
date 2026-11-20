/**
 * Bulk Vehicle CSV Upload API — POST /api/upload-vehicles
 *
 * Delegates spreadsheet parsing, 2-way driver/ticket/claim reconciliation,
 * and Cloud WAL flushing to `ingestVehiclesFile`.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ingestVehiclesFile } from "@/lib/services/vehicleImportService";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s execution on Vercel for bulk imports

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(["ADMIN", "OPS_MANAGER", "FLEET_PERF_MANAGER"]);
    if ("error" in authResult) {
      return authResult.error;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier CSV ou Excel fourni." }, { status: 400 });
    }

    const result = await ingestVehiclesFile(file);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error("POST /api/upload-vehicles error:", error);
    return NextResponse.json(
      { error: error?.message || "Échec du traitement du fichier CSV de la flotte." },
      { status: 500 }
    );
  }
}
