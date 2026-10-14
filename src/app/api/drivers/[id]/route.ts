/**
 * Single Driver API — PATCH & DELETE /api/drivers/[id]
 *
 * Updates driver profile, handles vehicle assignment/unassignment,
 * changes stage/arrears, or deletes driver record.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { syncVehicleAssignmentToLead } from "@/lib/services/leadVehicleReconciliation";
import { touchSyncState } from "@/lib/sync";
import { invalidateDriverCache } from "@/lib/driverCache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const { id } = await params;
    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        assignedVehicle: true,
        tickets: true,
        payments: true,
        accidentClaims: true,
        comments: {
          orderBy: { createdAt: "desc" },
        },
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
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
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
      isRedFlagged,
      redFlagReason,
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

    if (isRedFlagged !== undefined) {
      const willBeFlagged = Boolean(isRedFlagged);
      updateData.isRedFlagged = willBeFlagged;
      if (willBeFlagged) {
        updateData.redFlagReason = redFlagReason ? String(redFlagReason).trim() : (currentDriver.redFlagReason || "Signalé par le gestionnaire de flotte");
        updateData.redFlaggedAt = new Date();
        const userObj = "user" in authResult ? (authResult as any).user : null;
        updateData.redFlaggedBy = userObj?.name || userObj?.fullName || userObj?.email || "Gestionnaire Flotte";
      } else {
        updateData.redFlagReason = null;
        updateData.redFlaggedAt = null;
        updateData.redFlaggedBy = null;
      }
    } else if (redFlagReason !== undefined && currentDriver.isRedFlagged) {
      updateData.redFlagReason = redFlagReason ? String(redFlagReason).trim() : null;
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
        comments: {
          orderBy: { createdAt: "desc" },
        },
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
            assigned_driver_name: null,
            assigned_driver_phone: null,
          },
        }).catch(() => {});
      }

      // 2. Link new vehicle
      if (newVehicleId) {
        const linkedVehicle = await prisma.vehicle.update({
          where: { id: newVehicleId },
          data: {
            status: "Actif",
            assigned_driver_name: updatedDriver.fullName,
            assigned_driver_phone: updatedDriver.phoneSanitized,
          },
        }).catch(() => null);

        if (linkedVehicle) {
          await syncVehicleAssignmentToLead(
            { fullName: updatedDriver.fullName, phoneSanitized: updatedDriver.phoneSanitized },
            linkedVehicle
          ).catch(() => {});
        }
      }

      await touchSyncState("leads").catch(() => {});
    }

    invalidateDriverCache();
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
    const authResult = await requireAuth(["ADMIN", "OPS_MANAGER"]);
    if ("error" in authResult) {
      return authResult.error;
    }
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

    invalidateDriverCache();
    return NextResponse.json({ success: true, message: "Driver removed successfully" });
  } catch (error: any) {
    console.error("DELETE /api/drivers/[id] error:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete driver" }, { status: 500 });
  }
}
