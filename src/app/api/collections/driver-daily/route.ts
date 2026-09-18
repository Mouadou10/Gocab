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
import { touchSyncState } from "@/lib/sync";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    let startDateStr = searchParams.get("startDate") || dateParam || new Date().toISOString().split("T")[0];
    let endDateStr = searchParams.get("endDate") || dateParam || startDateStr;

    // Ensure startDateStr <= endDateStr
    if (startDateStr > endDateStr) {
      const temp = startDateStr;
      startDateStr = endDateStr;
      endDateStr = temp;
    }

    const isRange = startDateStr !== endDateStr;

    // Target boundaries for ledger querying
    const startOfRange = new Date(`${startDateStr}T00:00:00.000Z`);
    const endOfRange = new Date(`${endDateStr}T23:59:59.999Z`);

    // Build list of calendar days in range for expected contract calculation
    const daysInRange: { dateStr: string; dayOfWeek: number }[] = [];
    const cur = new Date(startOfRange);
    while (cur <= endOfRange) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const d = String(cur.getUTCDate()).padStart(2, "0");
      daysInRange.push({
        dateStr: `${y}-${m}-${d}`,
        dayOfWeek: cur.getUTCDay(),
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    const daysCount = daysInRange.length;

    // Fetch all drivers with assigned vehicle and payment ledger in date range
    const drivers = await prisma.driverProfile.findMany({
      include: {
        assignedVehicle: true,
        payments: {
          where: {
            paymentDate: {
              gte: startOfRange,
              lte: endOfRange,
            },
          },
          orderBy: { paymentDate: "asc" },
        },
      },
      orderBy: { fullName: "asc" },
    });

    // Check if morning or evening CSV was uploaded in this target date range
    const hasMorningCsv = drivers.some((d) =>
      d.payments.some((p) => p.morningBalance !== null && p.morningBalance !== undefined)
    );
    const hasEveningCsv = drivers.some((d) =>
      d.payments.some((p) => p.eveningBalance !== null && p.eveningBalance !== undefined)
    );

    let totalMorningTargetMAD = 0;
    let totalExpectedContractMAD = 0;
    let totalClearedTodayMAD = 0;
    let totalArrearsAllMAD = 0;
    let criticalRedCount = 0;

    const driverList = drivers.map((driver) => {
      const contract = (driver.contractType || "DAILY").toUpperCase();
      let expectedTodayMAD = 0;

      if (!isRange) {
        // Single day logic: 1800 on Monday for weekly, 300 on Mon-Sat for daily
        const dayOfWeek = startOfRange.getUTCDay();
        if (contract === "WEEKLY") {
          if (dayOfWeek === 1) {
            expectedTodayMAD = 1800;
          }
        } else {
          if (dayOfWeek >= 1 && dayOfWeek <= 6) {
            expectedTodayMAD = 300;
          }
        }
      } else {
        // Range logic: sum across days in range
        if (contract === "WEEKLY") {
          const mondayCount = daysInRange.filter((d) => d.dayOfWeek === 1).length;
          expectedTodayMAD = Math.max(
            mondayCount * 1800,
            mondayCount === 0 && daysCount >= 7 ? 1800 : 0
          );
        } else {
          const workingDays = daysInRange.filter((d) => d.dayOfWeek >= 1 && d.dayOfWeek <= 6).length;
          expectedTodayMAD = workingDays * 300;
        }
      }

      // Check payments in range
      const clearedTodayMAD = driver.payments.reduce((sum, p) => sum + (p.clearedMAD || 0), 0);
      const isPaidToday = expectedTodayMAD > 0 ? clearedTodayMAD >= expectedTodayMAD : clearedTodayMAD > 0;

      // Negative morning balance in CSV represents the driver debt / collection target
      let morningDebt = 0;
      if (hasMorningCsv) {
        if (!isRange) {
          const todayPayment = driver.payments[0];
          if (todayPayment?.morningBalance !== null && todayPayment?.morningBalance !== undefined) {
            morningDebt = Math.abs(Math.min(0, todayPayment.morningBalance));
          }
        } else {
          const firstWithMorning = driver.payments.find(
            (p) => p.morningBalance !== null && p.morningBalance !== undefined
          );
          if (firstWithMorning && firstWithMorning.morningBalance !== null) {
            morningDebt = Math.abs(Math.min(0, firstWithMorning.morningBalance));
          }
        }
      }

      // Current arrears: reflects latest balance (evening if uploaded, morning if uploaded, else driver profile)
      let currentArrears = driver.currentArrearsMAD;
      const latestPayment = driver.payments[driver.payments.length - 1];
      if (latestPayment?.eveningBalance !== null && latestPayment?.eveningBalance !== undefined) {
        currentArrears = Math.abs(Math.min(0, latestPayment.eveningBalance));
      } else if (hasMorningCsv && latestPayment?.morningBalance !== null && latestPayment?.morningBalance !== undefined) {
        currentArrears = Math.abs(Math.min(0, latestPayment.morningBalance));
      }

      totalMorningTargetMAD += morningDebt;
      totalExpectedContractMAD += expectedTodayMAD;
      totalClearedTodayMAD += clearedTodayMAD;
      totalArrearsAllMAD += currentArrears;

      // 3rd Day Red Rule: Evaluated when morning or evening CSV has been uploaded
      let isCriticalRed = false;
      const unpaidDays =
        driver.consecutiveUnpaidDays > 0
          ? driver.consecutiveUnpaidDays
          : currentArrears > 0
          ? Math.max(1, Math.ceil(currentArrears / 300))
          : 0;

      if (hasMorningCsv || hasEveningCsv) {
        isCriticalRed = unpaidDays >= 3 || currentArrears >= 900;
        if (isCriticalRed) criticalRedCount++;
      }

      const firstPayment = driver.payments[0];
      const totalDelta = driver.payments.reduce((sum, p) => sum + (p.calculatedDelta || 0), 0);

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
        currentArrearsMAD: currentArrears,
        consecutiveUnpaidDays: (hasMorningCsv || hasEveningCsv) ? unpaidDays : 0,
        isCriticalRed,
        expectedTodayMAD,
        clearedTodayMAD,
        isPaidToday,
        morningBalance: firstPayment?.morningBalance ?? null,
        eveningBalance: latestPayment?.eveningBalance ?? null,
        calculatedDelta: driver.payments.length > 1 ? totalDelta : (firstPayment?.calculatedDelta ?? null),
        paymentNote: latestPayment?.notes || null,
        paymentLedgerId: latestPayment?.id || null,
      };
    });

    // When hasMorningCsv is true and morning debt exists, use it; otherwise use expected contract sum
    const effectiveTargetMAD =
      hasMorningCsv && totalMorningTargetMAD > 0
        ? totalMorningTargetMAD
        : totalExpectedContractMAD;
    const remainingToCollectMAD = Math.max(0, effectiveTargetMAD - totalClearedTodayMAD);
    const target60PercentMAD = Math.round(effectiveTargetMAD * 0.6);
    const collectionPercentage =
      effectiveTargetMAD > 0 ? (totalClearedTodayMAD / effectiveTargetMAD) * 100 : 0;

    return NextResponse.json({
      date: startDateStr,
      startDate: startDateStr,
      endDate: endDateStr,
      isRange,
      daysCount,
      dayOfWeek: startOfRange.getUTCDay(),
      hasMorningCsv,
      hasEveningCsv,
      summary: {
        totalDrivers: drivers.length,
        totalExpectedTodayMAD: effectiveTargetMAD,
        totalMorningTargetMAD: effectiveTargetMAD,
        totalClearedTodayMAD,
        remainingToCollectMAD,
        totalArrearsAllMAD,
        target60PercentMAD,
        collectionPercentage,
        criticalRedCount,
        hasMorningCsv,
        hasEveningCsv,
        isRange,
        daysCount,
        startDate: startDateStr,
        endDate: endDateStr,
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

    // Notify all open sessions (Dashboard, Perf page) to refresh
    await touchSyncState("collections");

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
