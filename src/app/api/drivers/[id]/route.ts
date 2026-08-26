/**
 * Single Driver API — PATCH & DELETE /api/drivers/[id]
 *
 * Updates driver profile, handles vehicle assignment/unassignment,
 * changes stage/arrears, or deletes driver record.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        assignedVehicle: true,
        tickets: true,
        payments: true,
        accidentClaims: true,
      },
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    return NextResponse.json({ driver });
  } catch (error: any) {
    console.error("GET /api/drivers/[id] error:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch driver" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const currentDriver = await prisma.driverProfile.findUnique({
      where: { id },
    });

    if (!currentDriver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    const updateData: any = {};

    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (age !== undefined) updateData.age = Number(age);
    if (licenseSeniority !== undefined) updateData.licenseSeniority = Number(licenseSeniority);
    if (contractType !== undefined) updateData.contractType = contractType;
    if (currentArrearsMAD !== undefined) updateData.currentArrearsMAD = Number(currentArrearsMAD);
    if (isKycVerified !== undefined) updateData.isKycVerified = Boolean(isKycVerified);
    if (defaultStage !== undefined) updateData.defaultStage = defaultStage;

    if (phone !== undefined) {
      let cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
      if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
      if (cleaned.startsWith("212")) cleaned = cleaned.slice(3);
      cleaned = cleaned.replace(/^0+/, "");
      if (cleaned.length >= 8) {
        updateData.phoneSanitized = `+212${cleaned}`;
      }
    }

    if (cinNumber !== undefined) {
      updateData.cinNumber = cinNumber.trim().toUpperCase();
    }

    // Vehicle Assignment Change Handling
    const oldVehicleId = currentDriver.assignedVehicleId;
    const newVehicleId = assignedVehicleId !== undefined ? assignedVehicleId : oldVehicleId;

    if (assignedVehicleId !== undefined) {
      updateData.assignedVehicleId = assignedVehicleId || null;
    }

    const updatedDriver = await prisma.driverProfile.update({
      where: { id },
      data: updateData,
      include: {
        assignedVehicle: true,
      },
    });

    // If vehicle changed:
    if (assignedVehicleId !== undefined && oldVehicleId !== newVehicleId) {
      // 1. Unlink old vehicle
      if (oldVehicleId) {
        await prisma.vehicle.update({
          where: { id: oldVehicleId },
          data: {
            status: "Available",
          },
        });
      }

      // 2. Link new vehicle
      if (newVehicleId) {
        await prisma.vehicle.update({
          where: { id: newVehicleId },
          data: {
            status: "Actif",
          },
        });
      }
    }

    return NextResponse.json({ driver: updatedDriver });
  } catch (error: any) {
    console.error("PATCH /api/drivers/[id] error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update driver" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Unlink vehicle if assigned
    if (driver.assignedVehicleId) {
      await prisma.vehicle.update({
        where: { id: driver.assignedVehicleId },
        data: {
          status: "Available",
        },
      });
    }

    await prisma.driverProfile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Driver removed successfully" });
  } catch (error: any) {
    console.error("DELETE /api/drivers/[id] error:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete driver" }, { status: 500 });
  }
}
