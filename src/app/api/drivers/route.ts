import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unassignedOnly = searchParams.get("unassigned") === "true";
    const currentVehicleId = searchParams.get("current_vehicle_id");

    const where: any = {};
    if (unassignedOnly) {
      if (currentVehicleId) {
        where.OR = [
          { assignedVehicleId: null },
          { assignedVehicleId: currentVehicleId }
        ];
      } else {
        where.assignedVehicleId = null;
      }
    }

    const drivers = await prisma.driverProfile.findMany({
      where,
      orderBy: { fullName: "asc" }
    });

    return NextResponse.json({ drivers });
  } catch (error) {
    console.error("GET /api/drivers error:", error);
    return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 500 });
  }
}
