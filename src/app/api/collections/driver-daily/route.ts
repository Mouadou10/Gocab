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
import { getActiveRedFlagsLookup } from "@/lib/services/redFlagService";

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
    const [drivers, allVehicles, redFlagsLookup] = await Promise.all([
      prisma.driverProfile.findMany({
        where: {
          is_archived: false,
          assignedVehicleId: { not: null },
        },
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
          comments: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { fullName: "asc" },
      }),
      prisma.vehicle.findMany({
        where: { is_archived: false },
        select: {
          id: true,
          plate_number: true,
          make_model: true,
          status: true,
          assigned_driver_name: true,
          assigned_driver_phone: true,
          assigned_supervisor: true,
          assigned_collector: true,
        },
      }),
      getActiveRedFlagsLookup(),
    ]);

    // Build fallback lookup maps for vehicles by driver phone and name
    const alreadyAssignedVehicleIds = new Set<string>();
    for (const d of drivers) {
      if (d.assignedVehicleId) {
        alreadyAssignedVehicleIds.add(d.assignedVehicleId);
      }
    }

    const vehicleByDriverPhone = new Map<string, typeof allVehicles[0]>();
    const vehicleByDriverName = new Map<string, typeof allVehicles[0]>();
    for (const v of allVehicles) {
      if (v.assigned_driver_phone) {
        const cleanP = v.assigned_driver_phone.replace(/\D/g, "").slice(-9);
        if (cleanP) vehicleByDriverPhone.set(cleanP, v);
      }
      if (v.assigned_driver_name) {
        const cleanN = v.assigned_driver_name.toLowerCase().replace(/\s+/g, " ").trim();
        if (cleanN) vehicleByDriverName.set(cleanN, v);
      }
    }

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

    const driverList: any[] = [];

    for (const driver of drivers) {
      let resolvedVehicle = driver.assignedVehicle
        ? {
            id: driver.assignedVehicle.id,
            plate_number: driver.assignedVehicle.plate_number,
            make_model: driver.assignedVehicle.make_model,
            status: driver.assignedVehicle.status,
            assigned_supervisor: driver.assignedVehicle.assigned_supervisor,
            assigned_collector: driver.assignedVehicle.assigned_collector,
          }
        : null;

      if (!resolvedVehicle) {
        const cleanP = driver.phoneSanitized?.replace(/\D/g, "").slice(-9);
        let fbV = cleanP ? vehicleByDriverPhone.get(cleanP) : null;
        if (!fbV && driver.fullName) {
          const cleanN = driver.fullName.toLowerCase().replace(/\s+/g, " ").trim();
          fbV = vehicleByDriverName.get(cleanN) || null;
        }
        if (fbV && !alreadyAssignedVehicleIds.has(fbV.id)) {
          const vDriverName = (fbV.assigned_driver_name || "").toLowerCase().replace(/\s+/g, " ").trim();
          const dName = (driver.fullName || "").toLowerCase().replace(/\s+/g, " ").trim();
          const vPhone = (fbV.assigned_driver_phone || "").replace(/\D/g, "").slice(-9);
          if (vDriverName === dName || (cleanP && vPhone && vPhone === cleanP)) {
            alreadyAssignedVehicleIds.add(fbV.id);
            resolvedVehicle = {
              id: fbV.id,
              plate_number: fbV.plate_number,
              make_model: fbV.make_model,
              status: fbV.status,
              assigned_supervisor: fbV.assigned_supervisor,
              assigned_collector: fbV.assigned_collector,
            };
            // Self-heal in background
            prisma.driverProfile.updateMany({
              where: { id: driver.id, assignedVehicleId: null },
              data: { assignedVehicleId: fbV.id },
            }).catch(() => {});
          }
        }
      }

      // Strictly skip drivers without any car assigned
      if (!resolvedVehicle) {
        continue;
      }

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
      const rawExcelBalance =
        latestPayment?.eveningBalance !== null && latestPayment?.eveningBalance !== undefined
          ? latestPayment.eveningBalance
          : (hasMorningCsv && latestPayment?.morningBalance !== null && latestPayment?.morningBalance !== undefined)
          ? latestPayment.morningBalance
          : null;

      if (rawExcelBalance !== null) {
        currentArrears = rawExcelBalance < 0 ? Math.abs(rawExcelBalance) : 0;
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
      const manager = resolvedVehicle?.assigned_collector || resolvedVehicle?.assigned_supervisor || null;

      // Comments for this driver (linked to specific date + full history)
      const targetDateKey = endDateStr || startDateStr;
      const driverComments = (driver.comments || []).map((c) => ({
        id: c.id,
        authorName: c.authorName,
        authorRole: c.authorRole,
        content: c.content,
        commentDate: c.commentDate || c.createdAt.toISOString().split("T")[0],
        createdAt: c.createdAt.toISOString(),
      }));

      const todayComments = driverComments.filter((c) => c.commentDate === targetDateKey);
      const todayComment = todayComments[0] || null;

      const rfCheck = redFlagsLookup.checkDriver({
        id: driver.id,
        name: driver.fullName,
        phone: driver.phoneSanitized,
        cin: driver.cinNumber,
      });
      const isRedFlagged = Boolean(driver.isRedFlagged || rfCheck.isRedFlagged);
      const redFlagReason = driver.redFlagReason || rfCheck.reason || null;

      driverList.push({
        id: driver.id,
        fullName: driver.fullName,
        phoneSanitized: driver.phoneSanitized,
        cinNumber: driver.cinNumber,
        contractType: contract,
        vehicle: {
          ...resolvedVehicle,
          manager,
        },
        manager,
        currentArrearsMAD: currentArrears,
        excelBalance: rawExcelBalance,
        consecutiveUnpaidDays: (hasMorningCsv || hasEveningCsv) ? unpaidDays : 0,
        isCriticalRed,
        isRedFlagged,
        redFlagReason,
        expectedTodayMAD,
        clearedTodayMAD,
        isPaidToday,
        morningBalance: firstPayment?.morningBalance ?? null,
        eveningBalance: latestPayment?.eveningBalance ?? null,
        calculatedDelta: driver.payments.length > 1 ? totalDelta : (firstPayment?.calculatedDelta ?? null),
        paymentNote: latestPayment?.notes || null,
        paymentLedgerId: latestPayment?.id || null,
        todayComment: todayComment ? todayComment.content : null,
        todayCommentAuthor: todayComment ? todayComment.authorName : null,
        todayCommentDate: todayComment ? todayComment.commentDate : null,
        commentsCount: driverComments.length,
        comments: driverComments,
      });
    }

    // Count total vehicles per manager from all active vehicles
    let azizVehiclesCount = 0;
    let mehdiVehiclesCount = 0;
    for (const v of allVehicles) {
      const mgr = (v.assigned_collector || v.assigned_supervisor || "").toLowerCase();
      if (mgr.includes("mehdi")) mehdiVehiclesCount++;
      else if (mgr.includes("aziz")) azizVehiclesCount++;
    }

    // Collect all managers present in active driver list
    const managerCounts = new Map<string, { name: string; count: number; vehicleCount: number; arrears: number }>();
    for (const d of driverList) {
      if (d.manager) {
        const rawM = d.manager.trim();
        const key = rawM.toLowerCase();
        const isAziz = key.includes("aziz");
        const isMehdi = key.includes("mehdi");
        const formattedName = isMehdi
          ? "Mehdi Elyattouti"
          : isAziz
          ? "Mohamed Aziz"
          : rawM
              .split(" ")
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");
        const curr = managerCounts.get(key) || {
          name: formattedName,
          count: 0,
          vehicleCount: isAziz ? azizVehiclesCount : isMehdi ? mehdiVehiclesCount : 0,
          arrears: 0,
        };
        curr.count += 1;
        curr.arrears += d.currentArrearsMAD || 0;
        managerCounts.set(key, curr);
      }
    }
    const managers = Array.from(managerCounts.values()).sort((a, b) => b.count - a.count);

    // Filter by manager if requested
    const managerParam = searchParams.get("manager");
    let targetDriverSet = driverList;
    if (managerParam && managerParam !== "ALL") {
      const targetM = managerParam.trim().toLowerCase();
      targetDriverSet = driverList.filter((d) =>
        d.manager ? d.manager.toLowerCase().includes(targetM) || targetM.includes(d.manager.toLowerCase()) : false
      );
    }

    // Calculate individual portfolio stats for Aziz and Mehdi
    const azizDrivers = driverList.filter((d) => (d.manager || "").toLowerCase().includes("aziz"));
    const mehdiDrivers = driverList.filter((d) => (d.manager || "").toLowerCase().includes("mehdi"));

    const calcPortfolioMetrics = (subset: typeof driverList, totalVehicles: number) => {
      let mDebt = 0;
      let expMAD = 0;
      let clrMAD = 0;
      let arrMAD = 0;
      let redCount = 0;
      for (const d of subset) {
        const morningD = d.morningBalance !== null && d.morningBalance !== undefined ? Math.abs(Math.min(0, d.morningBalance)) : 0;
        mDebt += morningD;
        expMAD += d.expectedTodayMAD || 0;
        clrMAD += d.clearedTodayMAD || 0;
        arrMAD += d.currentArrearsMAD || 0;
        if (d.isCriticalRed) redCount++;
      }
      const effTarget = hasMorningCsv && mDebt > 0 ? mDebt : expMAD;
      return {
        vehicleCount: totalVehicles,
        driverCount: subset.length,
        targetMAD: effTarget,
        clearedMAD: clrMAD,
        remainingMAD: Math.max(0, effTarget - clrMAD),
        target50PercentMAD: Math.round(effTarget * 0.5),
        target60PercentMAD: Math.round(effTarget * 0.6),
        target85PercentMAD: Math.round(effTarget * 0.85),
        remainingFor85PercentMAD: Math.max(0, Math.round(effTarget * 0.85) - clrMAD),
        is85PercentWeeklyAchieved: effTarget > 0 ? (clrMAD / effTarget) >= 0.85 : false,
        arrearsMAD: arrMAD,
        criticalRedCount: redCount,
        collectionPercentage: effTarget > 0 ? (clrMAD / effTarget) * 100 : 0,
      };
    };

    const portfolios = {
      aziz: calcPortfolioMetrics(azizDrivers, azizVehiclesCount),
      mehdi: calcPortfolioMetrics(mehdiDrivers, mehdiVehiclesCount),
    };

    // Calculate metrics for target set (filtered or global)
    let subMorningTargetMAD = 0;
    let subExpectedContractMAD = 0;
    let subClearedTodayMAD = 0;
    let subArrearsAllMAD = 0;
    let subCriticalRedCount = 0;

    for (const d of targetDriverSet) {
      const morningD = d.morningBalance !== null && d.morningBalance !== undefined ? Math.abs(Math.min(0, d.morningBalance)) : 0;
      subMorningTargetMAD += morningD;
      subExpectedContractMAD += d.expectedTodayMAD || 0;
      subClearedTodayMAD += d.clearedTodayMAD || 0;
      subArrearsAllMAD += d.currentArrearsMAD || 0;
      if (d.isCriticalRed) subCriticalRedCount++;
    }

    const effectiveTargetMAD =
      hasMorningCsv && subMorningTargetMAD > 0
        ? subMorningTargetMAD
        : subExpectedContractMAD;
    const remainingToCollectMAD = Math.max(0, effectiveTargetMAD - subClearedTodayMAD);
    const target60PercentMAD = Math.round(effectiveTargetMAD * 0.6);
    const collectionPercentage =
      effectiveTargetMAD > 0 ? (subClearedTodayMAD / effectiveTargetMAD) * 100 : 0;

    // Aggregation of unassigned drivers debt for complete cross-system transparency
    const unassignedDebtAgg = await prisma.driverProfile.aggregate({
      where: { assignedVehicleId: null },
      _sum: { currentArrearsMAD: true },
      _count: { id: true },
    });
    const unassignedArrearsMAD = unassignedDebtAgg._sum.currentArrearsMAD || 0;
    const unassignedCount = unassignedDebtAgg._count.id || 0;
    const globalSystemArrearsMAD = subArrearsAllMAD + unassignedArrearsMAD;

    return NextResponse.json({
      date: startDateStr,
      startDate: startDateStr,
      endDate: endDateStr,
      isRange,
      daysCount,
      dayOfWeek: startOfRange.getUTCDay(),
      hasMorningCsv,
      hasEveningCsv,
      managers,
      portfolios,
      selectedManager: managerParam || "ALL",
      summary: {
        totalDrivers: targetDriverSet.length,
        totalExpectedTodayMAD: effectiveTargetMAD,
        totalMorningTargetMAD: effectiveTargetMAD,
        totalClearedTodayMAD: subClearedTodayMAD,
        remainingToCollectMAD,
        totalArrearsAllMAD: subArrearsAllMAD,
        unassignedArrearsMAD,
        unassignedCount,
        globalSystemArrearsMAD,
        target50PercentMAD: Math.round(effectiveTargetMAD * 0.5),
        target60PercentMAD,
        target85PercentMAD: Math.round(effectiveTargetMAD * 0.85),
        remainingFor85PercentMAD: Math.max(0, Math.round(effectiveTargetMAD * 0.85) - subClearedTodayMAD),
        is85PercentWeeklyAchieved: effectiveTargetMAD > 0 ? (subClearedTodayMAD / effectiveTargetMAD) >= 0.85 : false,
        collectionPercentage,
        criticalRedCount: subCriticalRedCount,
        hasMorningCsv,
        hasEveningCsv,
        isRange,
        daysCount,
        startDate: startDateStr,
        endDate: endDateStr,
      },
      drivers: targetDriverSet,
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
