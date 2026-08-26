/**
 * Driver Daily Collections API — /api/collections/driver-daily
 *
 * Implements GoCab Driver Collection Logic:
 * 1. Contract Types:
 *    - WEEKLY: 1,800 MAD charged every Monday
 *    - DAILY: 300 MAD charged every day from Monday to Saturday (Sunday off)
 * 2. Daily Clearing:
 *    - Logs amount paid by driver each day (clearedMAD).
 * 3. 3rd-Day Critical Red Alert:
 *    - If a driver fails to pay for 2 consecutive days, on the 3rd day he is flagged in RED (isCriticalRed = true).
 * 4. Automatic Arrears Additions:
 *    - Unpaid daily/weekly amounts accumulate into currentArrearsMAD.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") || new Date().toISOString().split("T")[0];

    // Determine target date & day of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const targetDate = new Date(`${dateParam}T00:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay(); // 0 is Sunday, 1 is Monday...

    // Start & End of that target day for ledger querying
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Fetch all drivers with assigned vehicle and today's payment ledger
    const drivers = await prisma.driverProfile.findMany({
      include: {
        assignedVehicle: true,
        payments: {
          where: {
            paymentDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
    });

    let totalExpectedTodayMAD = 0;
    let totalClearedTodayMAD = 0;
    let totalArrearsAllMAD = 0;
    let criticalRedCount = 0;

    const driverList = drivers.map((driver) => {
      const contract = (driver.contractType || "DAILY").toUpperCase();
      let expectedTodayMAD = 0;

      if (contract === "WEEKLY") {
        // Weekly: 1,800 MAD charged every Monday (day 1)
        if (dayOfWeek === 1) {
          expectedTodayMAD = 1800;
        }
      } else {
        // Daily: 300 MAD per day Monday (1) to Saturday (6). Sunday (0) off.
        if (dayOfWeek >= 1 && dayOfWeek <= 6) {
          expectedTodayMAD = 300;
        }
      }

      // Check if payment was logged today
      const todayPayment = driver.payments[0];
      const clearedTodayMAD = todayPayment ? todayPayment.clearedMAD : 0;
      const isPaidToday = todayPayment ? todayPayment.clearedMAD >= expectedTodayMAD : false;

      totalExpectedTodayMAD += expectedTodayMAD;
      totalClearedTodayMAD += clearedTodayMAD;
      totalArrearsAllMAD += driver.currentArrearsMAD;

      // 3rd Day Red Rule: If unpaid for 2 days, on 3rd day -> RED ALERT
      const unpaidDays = driver.consecutiveUnpaidDays || 0;
      const isCriticalRed = unpaidDays >= 2 || driver.currentArrearsMAD >= 600;
      if (isCriticalRed) criticalRedCount++;

      return {
        id: driver.id,
        fullName: driver.fullName,
        phoneSanitized: driver.phoneSanitized,
        cinNumber: driver.cinNumber,
        contractType: contract,
        vehicle: driver.assignedVehicle
          ? {
              id: driver.assignedVehicle.id,
              plate_number: driver.assignedVehicle.plate_number,
              make_model: driver.assignedVehicle.make_model,
              status: driver.assignedVehicle.status,
            }
          : null,
        currentArrearsMAD: driver.currentArrearsMAD,
        consecutiveUnpaidDays: unpaidDays,
        isCriticalRed,
        expectedTodayMAD,
        clearedTodayMAD,
        isPaidToday,
        paymentNote: todayPayment?.notes || null,
        paymentLedgerId: todayPayment?.id || null,
      };
    });

    return NextResponse.json({
      date: dateParam,
      dayOfWeek,
      summary: {
        totalDrivers: drivers.length,
        totalExpectedTodayMAD,
        totalClearedTodayMAD,
        remainingToCollectMAD: Math.max(0, totalExpectedTodayMAD - totalClearedTodayMAD),
        totalArrearsAllMAD,
        criticalRedCount,
      },
      drivers: driverList,
    });
  } catch (error: any) {
    console.error("GET /api/collections/driver-daily error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch driver daily collections" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverId, date, clearedMAD, notes } = body;

    if (!driverId) {
      return NextResponse.json({ error: "Driver ID is required" }, { status: 400 });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { assignedVehicle: true },
    });

    if (!driver) {
      return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
    }

    const targetDate = date ? new Date(`${date}T12:00:00.000Z`) : new Date();
    const dayOfWeek = targetDate.getUTCDay();

    // Determine expected amount for that day
    const contract = (driver.contractType || "DAILY").toUpperCase();
    let expectedMAD = 0;
    if (contract === "WEEKLY") {
      if (dayOfWeek === 1) expectedMAD = 1800;
    } else {
      if (dayOfWeek >= 1 && dayOfWeek <= 6) expectedMAD = 300;
    }

    const paidAmount = Number(clearedMAD) || 0;
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Check existing payment ledger for that day
    const existingLedger = await prisma.paymentLedger.findFirst({
      where: {
        driverId,
        paymentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const previousPaid = existingLedger ? existingLedger.clearedMAD : 0;
    const paidDelta = paidAmount - previousPaid;

    // Arrears adjustment: paying reduces arrears, underpaying increases arrears
    let newArrears = Math.max(0, driver.currentArrearsMAD - paidDelta);

    // Consecutive unpaid days logic
    let newUnpaidDays = driver.consecutiveUnpaidDays;
    if (paidAmount >= expectedMAD && expectedMAD > 0) {
      newUnpaidDays = 0; // Reset streak
    } else if (paidAmount < expectedMAD && expectedMAD > 0) {
      if (!existingLedger || previousPaid === 0) {
        newUnpaidDays += 1;
      }
    }

    // Upsert PaymentLedger record
    if (existingLedger) {
      await prisma.paymentLedger.update({
        where: { id: existingLedger.id },
        data: {
          clearedMAD: paidAmount,
          expectedMAD,
          arrearsMAD: newArrears,
          notes: notes || existingLedger.notes,
        },
      });
    } else {
      await prisma.paymentLedger.create({
        data: {
          driverId,
          paymentDate: targetDate,
          expectedMAD,
          clearedMAD: paidAmount,
          arrearsMAD: newArrears,
          notes,
        },
      });
    }

    // Update DriverProfile
    const updatedDriver = await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        currentArrearsMAD: newArrears,
        consecutiveUnpaidDays: newUnpaidDays,
        lastPaymentDate: paidAmount > 0 ? new Date() : driver.lastPaymentDate,
        defaultStage: newArrears >= 1500 ? "DAY_3_BLOCK" : newArrears >= 600 ? "DAY_2_ACTION" : "NOMINAL",
      },
    });

    return NextResponse.json({
      success: true,
      driver: updatedDriver,
      paidAmount,
      newArrears,
      newUnpaidDays,
      isCriticalRed: newUnpaidDays >= 2 || newArrears >= 600,
    });
  } catch (error: any) {
    console.error("POST /api/collections/driver-daily error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to record driver payment" },
      { status: 500 }
    );
  }
}
