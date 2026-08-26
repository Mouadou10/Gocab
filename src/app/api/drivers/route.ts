/**
 * Driver Profiles API — GET & POST /api/drivers
 *
 * Manages Driver Profile records, vehicle attachments, and driver statistics.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unassignedOnly = searchParams.get("unassigned") === "true";
    const currentVehicleId = searchParams.get("current_vehicle_id");
    const query = searchParams.get("q")?.trim();
    const stage = searchParams.get("stage")?.trim();

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

    if (stage) {
      where.defaultStage = stage;
    }

    if (query) {
      where.OR = [
        { fullName: { contains: query } },
        { phoneSanitized: { contains: query } },
        { cinNumber: { contains: query } },
      ];
    }

    const drivers = await prisma.driverProfile.findMany({
      where,
      include: {
        assignedVehicle: true,
      },
      orderBy: { fullName: "asc" }
    });

    return NextResponse.json({ drivers });
  } catch (error: any) {
    console.error("GET /api/drivers error:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch drivers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fullName,
      phone,
      cinNumber,
      age,
      licenseSeniority,
      contractType,
      assignedVehicleId,
      currentArrearsMAD,
      isKycVerified,
      defaultStage,
    } = body;

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: "Full Name is required" }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Sanitize Moroccan phone number
    let cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
    if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
    if (cleaned.startsWith("212")) cleaned = cleaned.slice(3);
    cleaned = cleaned.replace(/^0+/, "");
    
    if (cleaned.length < 8) {
      return NextResponse.json(
        { error: "Invalid phone number format (e.g., 06 12 34 56 78)" },
        { status: 400 }
      );
    }

    const phoneSanitized = `+212${cleaned}`;

    // Check duplicate phone
    const existingPhone = await prisma.driverProfile.findUnique({
      where: { phoneSanitized },
    });
    if (existingPhone) {
      return NextResponse.json(
        { error: `Driver with phone ${phoneSanitized} already exists (${existingPhone.fullName}).` },
        { status: 409 }
      );
    }

    const cin = (cinNumber || `CIN-${cleaned.slice(-6)}`).trim().toUpperCase();

    // Check duplicate CIN
    const existingCin = await prisma.driverProfile.findUnique({
      where: { cinNumber: cin },
    });
    if (existingCin) {
      return NextResponse.json(
        { error: `Driver with CIN ${cin} already exists (${existingCin.fullName}).` },
        { status: 409 }
      );
    }

    // Create Driver
    const driver = await prisma.driverProfile.create({
      data: {
        fullName: fullName.trim(),
        phoneSanitized,
        cinNumber: cin,
        age: age ? Number(age) : 28,
        licenseSeniority: licenseSeniority ? Number(licenseSeniority) : 2,
        contractType: contractType || "STANDARD",
        isKycVerified: isKycVerified !== undefined ? Boolean(isKycVerified) : true,
        currentArrearsMAD: currentArrearsMAD ? Number(currentArrearsMAD) : 0.0,
        defaultStage: defaultStage || "NOMINAL",
        monthlyTripCount: 0,
        assignedVehicleId: assignedVehicleId || null,
      },
      include: {
        assignedVehicle: true,
      },
    });

    // If vehicle was assigned, mark vehicle as Actif
    if (assignedVehicleId) {
      await prisma.vehicle.update({
        where: { id: assignedVehicleId },
        data: {
          status: "Actif",
        },
      });
    }

    return NextResponse.json({ driver }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/drivers error:", error);
    return NextResponse.json({ error: error?.message || "Failed to create driver" }, { status: 500 });
  }
}
