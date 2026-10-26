/**
 * Executive Global Operations & Financial Command Center API — GET /api/reports/financial
 *
 * Engineered for the Director of Operations (Senior Data Engineering & Business Intelligence):
 * 1. Global Team Work Composite Score & Department/Agent KPIs across the selected Date Range
 * 2. Assigned Vehicles & Preorders during the selected Date Range (plus conversion funnel)
 * 3. % of Churn & Uncollected Lost Debt ("Lost Money") after firing/recovering drivers without collecting debt
 * 4. Fleet Composition Percentages: % In Service, % Available, % Missing Docs, % in Maintenance, % Police/Impounded
 * 5. Fleet Cycle & Retention Durations:
 *    - AVG Days a vehicle stays assigned to the same driver (Driver Retention Tenure)
 *    - AVG Days a vehicle stays in "Available" status
 *    - AVG Days a vehicle stays in "Missing Docs" (missing_document) status
 *    - AVG Days a vehicle stays in "Maintenance" (In garage / Maintenance / Accident) status
 * 6. Collection & Debt Ratios: % Cash Collection Rate, % Uncollected Collection Debt, Active Arrears vs Bad Debt Write-Offs
 * 7. Per-Vehicle Financial & Operational Breakdown + Churned Drivers Bad Debt Ledger
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveRedFlagsLookup } from "@/lib/services/redFlagService";
import { getMoroccanWorkingDays } from "@/lib/moroccoCalendar";
import { isMehdiPlate } from "@/lib/fleet-managers";
import { getTargetsForRange, parseTargetHistory, getTargetForDate } from "@/lib/target-history";

export const dynamic = "force-dynamic";

const DAILY_OPPORTUNITY_COST_MAD = 250; // 250 MAD / day lost revenue per inactive vehicle

function parseStatusDurationDays(notes: string | null | undefined, fallbackDowntimeDays: number, updatedAt: Date): number {
  if (notes) {
    const m = notes.match(/Dur[ée]e\s*statut:\s*(\d+(?:\.\d+)?)/i);
    if (m && m[1]) {
      const parsed = parseFloat(m[1]);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  if (fallbackDowntimeDays && fallbackDowntimeDays > 0) {
    return fallbackDowntimeDays;
  }
  const diffDays = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0.5, Number(diffDays.toFixed(1)));
}

function normalizeDriverName(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const periodPreset = searchParams.get("period") || "THIS_MONTH";

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));

    if (fromParam || toParam) {
      startDate = fromParam
        ? new Date(`${fromParam}T00:00:00.000Z`)
        : new Date(Date.UTC(now.getFullYear(), 0, 1, 0, 0, 0));
      endDate = toParam
        ? new Date(`${toParam}T23:59:59.999Z`)
        : endDate;
    } else if (periodPreset === "TODAY") {
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    } else if (periodPreset === "YESTERDAY") {
      const y = new Date(now);
      y.setUTCDate(y.getUTCDate() - 1);
      startDate = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 0, 0, 0));
      endDate = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 23, 59, 59, 999));
    } else if (periodPreset === "7D") {
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0));
    } else if (periodPreset === "30D") {
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0));
    } else if (periodPreset === "ALL") {
      startDate = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    } else {
      // THIS_MONTH default
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
    }

    const moroccanDaysInfo = getMoroccanWorkingDays(startDate, endDate);
    const workingDays = Math.max(1, moroccanDaysInfo.workingDays);
    const calendarDays = Math.max(1, moroccanDaysInfo.totalCalendarDays);

    const dateFilter = { gte: startDate, lte: endDate };

    const [
      vehicles,
      expenses,
      drivers,
      leads,
      tickets,
      inspections,
      vehicleInspections,
      tasks,
      churnEvents,
      dailyCollections,
      periodPaymentLedgers,
      settingsRecord,
      targetHistoryRecord,
      redFlagsLookup,
    ] = await Promise.all([
      prisma.vehicle.findMany({
        where: { is_archived: false },
        include: {
          driverProfile: true,
          expenses: {
            where: { is_archived: false, paid_at: dateFilter },
          },
        },
      }),
      prisma.vehicleExpense.findMany({
        where: { is_archived: false, paid_at: dateFilter },
        orderBy: { paid_at: "desc" },
      }),
      prisma.driverProfile.findMany({
        select: {
          id: true,
          cinNumber: true,
          fullName: true,
          phoneSanitized: true,
          contractType: true,
          currentArrearsMAD: true,
          consecutiveUnpaidDays: true,
          lastPaymentDate: true,
          is_archived: true,
          isRedFlagged: true,
          redFlagReason: true,
          redFlaggedAt: true,
          assignedVehicleId: true,
        },
      }),
      prisma.lead.findMany({
        where: { is_archived: false },
        select: {
          id: true,
          raw_name: true,
          sanitized_phone: true,
          board_column: true,
          brand_status: true,
          training_status: true,
          preorder_amount: true,
          city: true,
          has_cin: true,
          has_fiche_anthropometrique: true,
          has_confirmation_adresse: true,
          has_permis: true,
          presence_confirmed: true,
          presence_confirmed_at: true,
          status_changed_at: true,
          reminder_date: true,
          handled_by: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.maintenanceTicket.findMany({
        where: { is_archived: false },
        select: {
          id: true,
          vehicle_id: true,
          plate_number: true,
          driver_name: true,
          driver_phone: true,
          ticket_type: true,
          description: true,
          status: true,
          field_status: true,
          repair_cost: true,
          started_at: true,
          created_at: true,
          resolved_at: true,
        },
      }),
      prisma.fieldInspectionNew.findMany({
        select: { id: true, vehicleId: true, inspectedAt: true },
      }),
      prisma.vehicleInspection.findMany({
        where: { inspection_date: dateFilter },
        select: { id: true, vehicle_id: true, health_score: true, inspection_date: true },
      }),
      prisma.fieldTask.findMany({
        select: {
          id: true,
          task_type: true,
          vehicle_id: true,
          plate_number: true,
          driver_name: true,
          driver_phone: true,
          description: true,
          status: true,
          recovery_duration_hours: true,
          duration_hours: true,
          linked_ticket_id: true,
          created_at: true,
          completed_at: true,
        },
      }),
      prisma.churnEvent.findMany({
        orderBy: { churned_at: "desc" },
      }),
      prisma.dailyCollection.findMany({
        where: { date: dateFilter },
      }),
      prisma.paymentLedger.findMany({
        where: { paymentDate: dateFilter },
        select: {
          id: true,
          driverId: true,
          paymentDate: true,
          expectedMAD: true,
          clearedMAD: true,
          arrearsMAD: true,
          morningBalance: true,
          eveningBalance: true,
          calculatedDelta: true,
        },
      }),
      prisma.setting.findUnique({ where: { key: "department_weekly_targets" } }),
      prisma.setting.findUnique({ where: { key: "department_target_history" } }),
      getActiveRedFlagsLookup(),
    ]);

    // Parse custom department targets & date-effective daily target history
    let customTargets: any = {};
    if (settingsRecord?.value) {
      try {
        customTargets = JSON.parse(settingsRecord.value);
      } catch {}
    }

    const historyList = parseTargetHistory(targetHistoryRecord?.value, customTargets);

    // For ALL preset, bound target range start to earliest target snapshot or Oct 1, 2026
    const effectiveTargetStartDate =
      periodPreset === "ALL" && !fromParam
        ? new Date(
            `${historyList[0]?.effective_date || "2026-10-01"}T00:00:00.000Z`
          )
        : startDate;

    const targetRangeInfo = getTargetsForRange(
      effectiveTargetStartDate,
      endDate,
      historyList,
      customTargets
    );

    const targetDailyCalls = targetRangeInfo.avgDailyCalls;
    const targetDailyTrainingFixed = targetRangeInfo.avgDailyTraining;
    const targetDailyAttended = targetRangeInfo.avgDailyAttended;
    const targetDailyPreorders = targetRangeInfo.avgDailyPreorders;
    const targetLeadConversionRate = targetRangeInfo.targetLeadConversionRate || 30;
    const targetMinCollectionRate = targetRangeInfo.targetMinCollectionRate || 50;
    const targetMaxCollectionRate = targetRangeInfo.targetMaxCollectionRate || 60;
    const targetMaxChurnRate = targetRangeInfo.targetMaxChurnRate || 20;
    const targetMaxMaintenanceDays = targetRangeInfo.targetMaxMaintenanceDays || 10;
    const targetMaxAvailableDays = targetRangeInfo.targetMaxAvailableDays || 1.0;
    const targetMaxMissingDocsDays = targetRangeInfo.targetMaxMissingDocsDays || 3.0;
    const targetMaxVidangeHours = targetRangeInfo.targetMaxVidangeHours || 1.0;
    const targetMaxFieldMissionHours = targetRangeInfo.targetMaxFieldMissionHours || 3.0;
    const targetSlaResolutionRate = targetRangeInfo.targetSlaResolutionRate || 95;
    const targetAttestationRate = targetRangeInfo.targetAttestationRate || 90;

    // =========================================================================
    // 1. FLEET STATUS BREAKDOWN (% Available, % Missing Docs, % Maintenance, % Working)
    // =========================================================================
    const totalFleet = vehicles.length;

    const isActifStatus = (s: string) =>
      ["Actif", "In service", "in service", "En service", "en service", "working"].includes(s);
    const isAvailableStatus = (s: string) =>
      ["Available", "Disponible", "disponible"].includes(s);
    const isMaintenanceStatus = (s: string) =>
      ["In garage", "maintenance", "Maintenance", "Accident"].includes(s);
    const isMissingDocStatus = (s: string) => s === "missing_document";
    const isPoliceImpoundedStatus = (s: string) =>
      ["police_immobilization", "impounded", "impounded by police", "Blocked"].includes(s);

    const activeVehicles = vehicles.filter((v) => isActifStatus(v.status));
    const availableVehicles = vehicles.filter((v) => isAvailableStatus(v.status));
    const inRepairVehicles = vehicles.filter((v) => isMaintenanceStatus(v.status));
    const missingDocVehicles = vehicles.filter((v) => isMissingDocStatus(v.status));
    const policeImpoundedVehicles = vehicles.filter((v) => isPoliceImpoundedStatus(v.status));
    const impoundedVehicles = [...missingDocVehicles, ...policeImpoundedVehicles];

    const totalActiveCount = activeVehicles.length;
    const totalInactiveCount = totalFleet - totalActiveCount;

    const pct = (count: number) =>
      totalFleet > 0 ? Number(((count / totalFleet) * 100).toFixed(1)) : 0;

    const fleetUtilizationRate = pct(totalActiveCount);
    const availableVehiclesPct = pct(availableVehicles.length);
    const maintenanceVehiclesPct = pct(inRepairVehicles.length);
    const missingDocsVehiclesPct = pct(missingDocVehicles.length);
    const policeImpoundedVehiclesPct = pct(policeImpoundedVehicles.length);

    // =========================================================================
    // 2. CYCLE DURATION & DRIVER TENURE AVERAGES (AVG Days)
    // =========================================================================
    // Build map of most recent churn date per vehicle so we can accurately measure
    // how long the CURRENT driver has been assigned to the vehicle
    const latestChurnDateByVehicleId = new Map<string, Date>();
    for (const ce of churnEvents) {
      if (!latestChurnDateByVehicleId.has(ce.vehicle_id)) {
        latestChurnDateByVehicleId.set(ce.vehicle_id, new Date(ce.churned_at));
      }
    }

    // 2A. AVG Days of a Vehicle Assigned to the Same Driver (Driver Tenure)
    const driverTenures: { plate: string; driver: string; days: number; manager: string }[] = [];
    for (const v of activeVehicles) {
      const driverName = v.driverProfile?.fullName || v.assigned_driver_name;
      if (!driverName) continue;

      let tenureDays = parseStatusDurationDays(v.notes, v.total_downtime_days, v.created_at);
      const lastChurn = latestChurnDateByVehicleId.get(v.id);
      if (lastChurn) {
        const daysSinceChurn = Math.max(1, Math.round((now.getTime() - lastChurn.getTime()) / (1000 * 60 * 60 * 24)));
        tenureDays = Math.min(tenureDays, daysSinceChurn);
      }
      const isMehdi = isMehdiPlate(v.plate_number) || (v.assigned_collector || v.assigned_supervisor || "").toLowerCase().includes("mehdi");
      driverTenures.push({
        plate: v.plate_number,
        driver: driverName,
        days: tenureDays,
        manager: isMehdi ? "Mehdi Elyattouti" : "Mohamed Aziz",
      });
    }

    const avgDaysAssignedToSameDriver =
      driverTenures.length > 0
        ? Number((driverTenures.reduce((s, d) => s + d.days, 0) / driverTenures.length).toFixed(1))
        : 0;

    const sortedTenures = [...driverTenures].sort((a, b) => a.days - b.days);
    const medianDaysAssignedToSameDriver =
      sortedTenures.length > 0
        ? sortedTenures[Math.floor(sortedTenures.length / 2)].days
        : 0;

    const tenureCohorts = {
      under15Days: driverTenures.filter((d) => d.days < 15).length,
      between15And45Days: driverTenures.filter((d) => d.days >= 15 && d.days <= 45).length,
      over45Days: driverTenures.filter((d) => d.days > 45).length,
    };

    // 2B. AVG Days Vehicle Stays as Available Status
    const availableDurations = availableVehicles.map((v) => ({
      plate: v.plate_number,
      days: parseStatusDurationDays(v.notes, v.total_downtime_days, v.updated_at),
    }));
    const avgDaysAvailable =
      availableDurations.length > 0
        ? Number((availableDurations.reduce((s, x) => s + x.days, 0) / availableDurations.length).toFixed(1))
        : 0;

    // 2C. AVG Days Vehicle Stays as Missing Docs Status
    const missingDocDurations = missingDocVehicles.map((v) => ({
      plate: v.plate_number,
      days: parseStatusDurationDays(v.notes, v.total_downtime_days, v.updated_at),
    }));
    const avgDaysMissingDocs =
      missingDocDurations.length > 0
        ? Number((missingDocDurations.reduce((s, x) => s + x.days, 0) / missingDocDurations.length).toFixed(1))
        : 0;

    // 2D. AVG Days Vehicle Stays as Maintenance Status
    const maintenanceDurations = inRepairVehicles.map((v) => ({
      plate: v.plate_number,
      days: parseStatusDurationDays(v.notes, v.total_downtime_days, v.updated_at),
    }));
    const avgDaysMaintenance =
      maintenanceDurations.length > 0
        ? Number((maintenanceDurations.reduce((s, x) => s + x.days, 0) / maintenanceDurations.length).toFixed(1))
        : 0;

    // =========================================================================
    // 3. ASSIGNED VEHICLES & PREORDERS DURING THE DATE RANGE
    // =========================================================================
    const isAttendedLead = (l: any) => {
      if (l.board_column === "VEHICLE_ASSIGNMENT") return true;
      if (Boolean(l.presence_confirmed)) return true;
      const ts = (l.training_status || "").trim().toLowerCase();
      if (!ts) return false;
      return (
        ts.includes("pending") ||
        ts.includes("attended") ||
        ts.includes("présent") ||
        ts.includes("present") ||
        ts.includes("preorder") ||
        ts.includes("assign") ||
        ts.includes("accept") ||
        ts.includes("refused")
      );
    };

    const getLeadEffectiveDate = (l: any): Date => {
      if (l.presence_confirmed_at) {
        const d = new Date(l.presence_confirmed_at);
        if (!isNaN(d.getTime())) return d;
      }
      if (l.status_changed_at) {
        const d = new Date(l.status_changed_at);
        if (!isNaN(d.getTime())) return d;
      }
      if (l.reminder_date) {
        const d = new Date(l.reminder_date);
        if (!isNaN(d.getTime())) return d;
      }
      return new Date(l.updated_at || l.created_at);
    };

    const isLeadInSelectedPeriod = (l: any): boolean => {
      const candidates = [
        l.status_changed_at,
        l.presence_confirmed_at,
        l.reminder_date,
        l.updated_at,
        l.created_at,
      ].filter(Boolean);
      return candidates.some((ts) => {
        const d = new Date(ts);
        return !isNaN(d.getTime()) && d >= startDate && d <= endDate;
      });
    };

    const isAssignedLead = (l: any) =>
      l.board_column === "VEHICLE_ASSIGNMENT" ||
      l.training_status === "Assign vehicle" ||
      l.training_status === "Accept offer";

    const isPreorderLead = (l: any) => l.training_status === "Preorder";

    const assignedLeadsAllTime = leads.filter(isAssignedLead);
    const preorderLeadsAllTime = leads.filter(isPreorderLead);

    const assignedLeadsInPeriod = assignedLeadsAllTime.filter(isLeadInSelectedPeriod);
    const preorderLeadsInPeriod = preorderLeadsAllTime.filter(isLeadInSelectedPeriod);

    const preorderAmountInPeriodMAD = preorderLeadsInPeriod.reduce(
      (sum, l) => sum + (Number(l.preorder_amount) || 0),
      0
    );
    const preorderAmountAllTimeMAD = preorderLeadsAllTime.reduce(
      (sum, l) => sum + (Number(l.preorder_amount) || 0),
      0
    );

    // Prospection Calls & Trainings Fixed in Period
    const trafficCallsLeadsInPeriod = leads.filter((l) => {
      if (l.board_column === "NEW_LEADS") return false;
      if (!(l.board_column === "BRAND_PRE_FILTER" || l.brand_status === "Training fixed")) return false;
      if (!l.status_changed_at) return false;
      const d = new Date(l.status_changed_at);
      return !isNaN(d.getTime()) && d >= startDate && d <= endDate;
    });

    const prospectionCallsInPeriod = trafficCallsLeadsInPeriod.length;
    const trainingsFixedInPeriod = trafficCallsLeadsInPeriod.filter(
      (l) => l.brand_status === "Training fixed"
    ).length;

    const trainingLeadsInPeriod = leads.filter(
      (l) =>
        (l.board_column === "TRAINING_PIPELINE" ||
          l.board_column === "VEHICLE_ASSIGNMENT" ||
          l.brand_status === "Training fixed") &&
        isLeadInSelectedPeriod(l)
    );
    const attendedInPeriod = trainingLeadsInPeriod.filter(isAttendedLead).length;

    // =========================================================================
    // 4. CHURN RATE & LOST MONEY AFTER FIRING / RECOVERING DRIVERS WITHOUT COLLECTING DEBT
    // =========================================================================
    const recoveryTickets = tickets.filter(
      (t) => t.ticket_type === "VEHICLE_RECOVERY" || t.ticket_type === "Vehicle Recovery"
    );
    const recoveryTasks = tasks.filter((t) => t.task_type === "VEHICLE_RECOVERY");

    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const driverByName = new Map<string, (typeof drivers)[number]>();
    const driverByPhone = new Map<string, (typeof drivers)[number]>();
    for (const d of drivers) {
      if (d.fullName) driverByName.set(normalizeDriverName(d.fullName), d);
      if (d.phoneSanitized) driverByPhone.set(d.phoneSanitized.trim(), d);
    }

    // Reconcile every ChurnEvent with recovery tickets, field tasks, and driver arrears
    const enrichedChurnLedger = churnEvents.map((ce) => {
      const cName = normalizeDriverName(ce.driver_name);
      const churnTime = new Date(ce.churned_at).getTime();

      const matchedTicket = recoveryTickets.find(
        (t) =>
          (cName && normalizeDriverName(t.driver_name) === cName) ||
          (t.vehicle_id === ce.vehicle_id &&
            Math.abs(new Date(t.created_at).getTime() - churnTime) <= 10 * 86400000)
      );
      const matchedTask = recoveryTasks.find(
        (t) =>
          (cName && normalizeDriverName(t.driver_name) === cName) ||
          (t.vehicle_id === ce.vehicle_id &&
            Math.abs(new Date(t.created_at).getTime() - churnTime) <= 10 * 86400000)
      );

      let extractedArrearsMAD = 0;
      let unpaidDaysAtTermination = 0;
      const combinedText = `${matchedTicket?.description || ""} ${matchedTask?.description || ""} ${ce.reason || ""}`;
      const mAmount = combinedText.match(/(\d+(?:\.\d+)?)\s*MAD\s*d'arri/i);
      if (mAmount && mAmount[1]) {
        extractedArrearsMAD = parseFloat(mAmount[1]);
      }
      const mDays = combinedText.match(/(\d+)\s*jours?\s*cons[ée]cutifs?\s*d'impay/i);
      if (mDays && mDays[1]) {
        unpaidDaysAtTermination = parseInt(mDays[1], 10);
      }

      const matchedDriver =
        (cName ? driverByName.get(cName) : undefined) ||
        (ce.driver_phone && ce.driver_phone !== "N/A" ? driverByPhone.get(ce.driver_phone.trim()) : undefined);

      // Only count driverProfile.currentArrearsMAD if the driver is no longer currently driving that vehicle
      const driverProfileDebt =
        matchedDriver && matchedDriver.assignedVehicleId !== ce.vehicle_id
          ? Number(matchedDriver.currentArrearsMAD) || 0
          : 0;

      const lostDebtMAD = Math.max(extractedArrearsMAD, driverProfileDebt);
      const veh = vehicleById.get(ce.vehicle_id);
      const isMehdi =
        isMehdiPlate(ce.plate_number) ||
        (veh && (veh.assigned_collector || veh.assigned_supervisor || "").toLowerCase().includes("mehdi"));

      const inSelectedPeriod =
        new Date(ce.churned_at) >= startDate && new Date(ce.churned_at) <= endDate;

      return {
        id: ce.id,
        vehicle_id: ce.vehicle_id,
        plate_number: ce.plate_number,
        driver_name: ce.driver_name || "Chauffeur Inconnu",
        driver_phone: ce.driver_phone || matchedDriver?.phoneSanitized || "N/A",
        manager: isMehdi ? "Mehdi Elyattouti" : "Mohamed Aziz",
        managerKey: isMehdi ? "mehdi" : "aziz",
        churned_at: ce.churned_at,
        reason: ce.reason || matchedTicket?.description || "Récupération véhicule / Fin de contrat",
        unpaid_days: unpaidDaysAtTermination || matchedDriver?.consecutiveUnpaidDays || 0,
        lost_debt_mad: lostDebtMAD,
        is_red_flagged: Boolean(matchedDriver?.isRedFlagged),
        in_selected_period: inSelectedPeriod,
      };
    });

    // Also include any recovery tickets with telematic arrears that didn't yet generate a ChurnEvent row
    const seenDriverPlateKeys = new Set(
      enrichedChurnLedger.map((c) => `${normalizeDriverName(c.driver_name)}|${c.plate_number}`)
    );

    for (const rt of recoveryTickets) {
      const dName = normalizeDriverName(rt.driver_name);
      const key = `${dName}|${rt.plate_number}`;
      if (!dName || seenDriverPlateKeys.has(key)) continue;

      const mAmount = (rt.description || "").match(/(\d+(?:\.\d+)?)\s*MAD\s*d'arri/i);
      if (!mAmount) continue;
      const lostDebtMAD = parseFloat(mAmount[1]);
      if (lostDebtMAD <= 0) continue;

      // Check if this driver is still assigned to this exact vehicle
      const veh = vehicleById.get(rt.vehicle_id);
      if (veh && normalizeDriverName(veh.assigned_driver_name) === dName) continue;

      seenDriverPlateKeys.add(key);
      const mDays = (rt.description || "").match(/(\d+)\s*jours?\s*cons[ée]cutifs?\s*d'impay/i);
      const isMehdi =
        isMehdiPlate(rt.plate_number) ||
        (veh && (veh.assigned_collector || veh.assigned_supervisor || "").toLowerCase().includes("mehdi"));
      const inSelectedPeriod =
        new Date(rt.created_at) >= startDate && new Date(rt.created_at) <= endDate;

      enrichedChurnLedger.push({
        id: `rec-${rt.id}`,
        vehicle_id: rt.vehicle_id,
        plate_number: rt.plate_number,
        driver_name: rt.driver_name || "Chauffeur",
        driver_phone: rt.driver_phone || "N/A",
        manager: isMehdi ? "Mehdi Elyattouti" : "Mohamed Aziz",
        managerKey: isMehdi ? "mehdi" : "aziz",
        churned_at: rt.created_at,
        reason: rt.description,
        unpaid_days: mDays ? parseInt(mDays[1], 10) : 0,
        lost_debt_mad: lostDebtMAD,
        is_red_flagged: true,
        in_selected_period: inSelectedPeriod,
      });
    }

    enrichedChurnLedger.sort(
      (a, b) => new Date(b.churned_at).getTime() - new Date(a.churned_at).getTime()
    );

    const churnInPeriodList = enrichedChurnLedger.filter((c) => c.in_selected_period);
    const churnCountInPeriod = churnInPeriodList.length;
    const churnCountAllTime = enrichedChurnLedger.length;

    const totalDriversPool = Math.max(totalActiveCount, 1);
    const periodChurnRatePct = Number(((churnCountInPeriod / totalDriversPool) * 100).toFixed(1));
    const monthsInPeriod = calendarDays > 31 ? calendarDays / 30 : 1;
    const monthlyChurnRatePct = Number((((churnCountInPeriod / monthsInPeriod) / totalDriversPool) * 100).toFixed(1));

    const lostDebtInPeriodMAD = churnInPeriodList.reduce((s, c) => s + c.lost_debt_mad, 0);
    const lostDebtAllTimeMAD = enrichedChurnLedger.reduce((s, c) => s + c.lost_debt_mad, 0);
    const firedWithDebtCountInPeriod = churnInPeriodList.filter((c) => c.lost_debt_mad > 0).length;
    const firedWithDebtCountAllTime = enrichedChurnLedger.filter((c) => c.lost_debt_mad > 0).length;
    const avgLostDebtPerFiredDriverMAD =
      firedWithDebtCountAllTime > 0
        ? Math.round(lostDebtAllTimeMAD / firedWithDebtCountAllTime)
        : 0;

    // =========================================================================
    // 5. COLLECTION & DEBT METRICS (% of Collection Debt)
    // =========================================================================
    const todayStr = now.toISOString().split("T")[0];
    const morningPaymentsToday = periodPaymentLedgers.filter((p) => {
      const dStr = new Date(p.paymentDate).toISOString().split("T")[0];
      return dStr === todayStr && p.morningBalance !== null;
    });

    let activeDriverArrearsMAD = 0;
    if (morningPaymentsToday.length > 0) {
      activeDriverArrearsMAD = morningPaymentsToday.reduce((sum, p) => {
        const bal = p.morningBalance ?? 0;
        return sum + (bal < 0 ? Math.abs(bal) : 0);
      }, 0);
    } else {
      activeDriverArrearsMAD = drivers
        .filter((d) => !d.is_archived && d.assignedVehicleId)
        .reduce((sum, d) => sum + (d.currentArrearsMAD || 0), 0);
    }

    // Period Collection Performance
    let periodExpectedTargetMAD = 0;
    let periodCollectedMAD = 0;
    for (const row of periodPaymentLedgers) {
      const mb = Number(row.morningBalance) || 0;
      if (mb < 0) periodExpectedTargetMAD += Math.abs(mb);
      else periodExpectedTargetMAD += Number(row.expectedMAD) || 0;

      const collected =
        Number(row.clearedMAD) ||
        (Number(row.calculatedDelta) && Number(row.calculatedDelta) > 0
          ? Number(row.calculatedDelta)
          : 0);
      periodCollectedMAD += collected;
    }

    if (periodExpectedTargetMAD === 0 && dailyCollections.length > 0) {
      periodExpectedTargetMAD = dailyCollections.reduce((acc, d) => acc + (Number(d.expected_total) || 0), 0);
      periodCollectedMAD = dailyCollections.reduce((acc, d) => acc + (Number(d.collected_total) || 0), 0);
    }

    const collectionRecoveryRatePct =
      periodExpectedTargetMAD > 0
        ? Number(((periodCollectedMAD / periodExpectedTargetMAD) * 100).toFixed(1))
        : 0;

    const uncollectedDebtMAD = Math.max(0, periodExpectedTargetMAD - periodCollectedMAD);
    const collectionDebtRatePct =
      periodExpectedTargetMAD > 0
        ? Number(((uncollectedDebtMAD / periodExpectedTargetMAD) * 100).toFixed(1))
        : 0;

    // Total cumulative debt exposure (Active Arrears + Fired Drivers Uncollected Bad Debt)
    const totalDebtExposureMAD = activeDriverArrearsMAD + lostDebtAllTimeMAD;
    const badDebtShareOfExposurePct =
      totalDebtExposureMAD > 0
        ? Number(((lostDebtAllTimeMAD / totalDebtExposureMAD) * 100).toFixed(1))
        : 0;

    // =========================================================================
    // 6. PORTFOLIO COMPARISON: MOHAMED AZIZ (75 véh.) vs MEHDI ELYATTOUTI (26 véh.)
    // =========================================================================
    const driverVehicleMap = new Map<string, string>();
    for (const d of drivers) {
      if (d.assignedVehicleId) driverVehicleMap.set(d.id, d.assignedVehicleId);
    }

    const computeManagerPortfolio = (mgrKey: "aziz" | "mehdi") => {
      const mgrVehicles = vehicles.filter((v) => {
        const isMehdi =
          isMehdiPlate(v.plate_number) ||
          (v.assigned_collector || v.assigned_supervisor || "").toLowerCase().includes("mehdi");
        return mgrKey === "mehdi" ? isMehdi : !isMehdi;
      });
      const vIds = new Set(mgrVehicles.map((v) => v.id));
      const totalV = mgrVehicles.length;
      const activeV = mgrVehicles.filter((v) => isActifStatus(v.status)).length;
      const availableV = mgrVehicles.filter((v) => isAvailableStatus(v.status)).length;
      const maintV = mgrVehicles.filter((v) => isMaintenanceStatus(v.status));
      const missingDocV = mgrVehicles.filter((v) => isMissingDocStatus(v.status)).length;
      const policeV = mgrVehicles.filter((v) => isPoliceImpoundedStatus(v.status)).length;

      let expMAD = 0;
      let colMAD = 0;
      for (const row of periodPaymentLedgers) {
        const vId = driverVehicleMap.get(row.driverId);
        if (!vId || !vIds.has(vId)) continue;
        const mb = Number(row.morningBalance) || 0;
        if (mb < 0) expMAD += Math.abs(mb);
        else expMAD += Number(row.expectedMAD) || 0;

        const collected =
          Number(row.clearedMAD) ||
          (Number(row.calculatedDelta) && Number(row.calculatedDelta) > 0
            ? Number(row.calculatedDelta)
            : 0);
        colMAD += collected;
      }

      const colRatePct = expMAD > 0 ? Number(((colMAD / expMAD) * 100).toFixed(1)) : 0;
      const debtPct = expMAD > 0 ? Number((100 - colRatePct).toFixed(1)) : 0;

      const mgrChurnsPeriod = churnInPeriodList.filter((c) => c.managerKey === mgrKey);
      const mgrChurnsAll = enrichedChurnLedger.filter((c) => c.managerKey === mgrKey);
      const mgrChurnRatePct =
        totalV > 0 ? Number((((mgrChurnsPeriod.length / monthsInPeriod) / totalV) * 100).toFixed(1)) : 0;
      const mgrLostDebtPeriodMAD = mgrChurnsPeriod.reduce((s, c) => s + c.lost_debt_mad, 0);
      const mgrLostDebtAllMAD = mgrChurnsAll.reduce((s, c) => s + c.lost_debt_mad, 0);

      const mgrMaintDays =
        maintV.length > 0
          ? Number(
              (
                maintV.reduce(
                  (s, v) => s + parseStatusDurationDays(v.notes, v.total_downtime_days, v.updated_at),
                  0
                ) / maintV.length
              ).toFixed(1)
            )
          : 0;

      const mgrTenures = driverTenures.filter((dt) =>
        mgrKey === "mehdi" ? dt.manager === "Mehdi Elyattouti" : dt.manager === "Mohamed Aziz"
      );
      const mgrAvgTenureDays =
        mgrTenures.length > 0
          ? Number((mgrTenures.reduce((s, d) => s + d.days, 0) / mgrTenures.length).toFixed(1))
          : 0;

      return {
        key: mgrKey,
        name: mgrKey === "mehdi" ? "Mehdi Elyattouti" : "Mohamed Aziz",
        totalVehicles: totalV,
        activeVehicles: activeV,
        utilizationPct: totalV > 0 ? Number(((activeV / totalV) * 100).toFixed(1)) : 0,
        availableVehicles: availableV,
        maintenanceVehicles: maintV.length,
        missingDocsVehicles: missingDocV,
        policeVehicles: policeV,
        expectedMAD: Math.round(expMAD),
        collectedMAD: Math.round(colMAD),
        collectionRatePct: colRatePct,
        collectionDebtPct: debtPct,
        churnCountPeriod: mgrChurnsPeriod.length,
        churnRatePct: mgrChurnRatePct,
        lostDebtPeriodMAD: Math.round(mgrLostDebtPeriodMAD),
        lostDebtAllTimeMAD: Math.round(mgrLostDebtAllMAD),
        avgMaintenanceDays: mgrMaintDays,
        avgDriverTenureDays: mgrAvgTenureDays,
      };
    };

    const portfolioComparison = {
      aziz: computeManagerPortfolio("aziz"),
      mehdi: computeManagerPortfolio("mehdi"),
    };

    // =========================================================================
    // 7. GLOBAL TEAM WORK COMPOSITE SCORE & 4 OPERATIONAL PILLARS (DATE-EFFECTIVE DAILY TARGETS)
    // =========================================================================
    // Pillar 1: Traffic & Acquisition (Nour Abouri & Kaoutar Ouardi)
    // Uses exact sum of each working day's target from department_target_history
    const scaledCallsTarget = Math.max(1, targetRangeInfo.scaledCallsTarget);
    const scaledTrainingFixedTarget = Math.max(1, targetRangeInfo.scaledTrainingTarget);
    const trafficConversionRatePct =
      prospectionCallsInPeriod > 0
        ? Number(((trainingsFixedInPeriod / prospectionCallsInPeriod) * 100).toFixed(1))
        : 0;

    const callsAttainment = Math.min(150, (prospectionCallsInPeriod / scaledCallsTarget) * 100);
    const trainingFixedAttainment = Math.min(150, (trainingsFixedInPeriod / scaledTrainingFixedTarget) * 100);
    const conversionAttainment = Math.min(
      150,
      (trafficConversionRatePct / Math.max(1, targetLeadConversionRate)) * 100
    );
    const trafficPillarScorePct = Number(
      (0.4 * callsAttainment + 0.4 * trainingFixedAttainment + 0.2 * conversionAttainment).toFixed(1)
    );

    // Pillar 2: Formation & Onboarding (Ayoub Gsaib)
    const scaledAttendedTarget = Math.max(1, targetRangeInfo.scaledAttendedTarget);
    const scaledPreordersAssignedTarget = Math.max(1, targetRangeInfo.scaledPreordersTarget);
    const totalAssignedAndPreordersInPeriod = assignedLeadsInPeriod.length + preorderLeadsInPeriod.length;
    const onboardingConversionRatePct =
      attendedInPeriod > 0
        ? Number(((totalAssignedAndPreordersInPeriod / attendedInPeriod) * 100).toFixed(1))
        : 0;

    const attendedAttainment = Math.min(150, (attendedInPeriod / scaledAttendedTarget) * 100);
    const assignedPreorderAttainment = Math.min(
      150,
      (totalAssignedAndPreordersInPeriod / scaledPreordersAssignedTarget) * 100
    );
    const velocityAttainment =
      avgDaysAvailable <= targetMaxAvailableDays
        ? 100
        : Math.max(0, Math.round((targetMaxAvailableDays / Math.max(0.5, avgDaysAvailable)) * 100));
    const onboardingPillarScorePct = Number(
      (0.4 * attendedAttainment + 0.4 * assignedPreorderAttainment + 0.2 * velocityAttainment).toFixed(1)
    );

    // Day-by-Day Performance vs Daily Target Breakdown
    const dailyTargetPerformance = targetRangeInfo.dailySchedule.map((dayEntry) => {
      const dStr = dayEntry.date;
      const dayCallsLeads = trafficCallsLeadsInPeriod.filter((l) => {
        const ts = l.status_changed_at || l.updated_at || l.created_at;
        return ts && new Date(ts).toISOString().split("T")[0] === dStr;
      });
      const actualCalls = dayCallsLeads.length;
      const actualFixed = dayCallsLeads.filter((l) => l.brand_status === "Training fixed").length;

      const dayAttended = trainingLeadsInPeriod.filter((l) => {
        if (!isAttendedLead(l)) return false;
        const ts = l.presence_confirmed_at || l.reminder_date || l.status_changed_at || l.created_at;
        return ts && new Date(ts).toISOString().split("T")[0] === dStr;
      }).length;

      const dayAssigned = assignedLeadsInPeriod.filter((l) => {
        const ts = l.status_changed_at || l.updated_at || l.created_at;
        return ts && new Date(ts).toISOString().split("T")[0] === dStr;
      }).length;
      const dayPreorders = preorderLeadsInPeriod.filter((l) => {
        const ts = l.status_changed_at || l.updated_at || l.created_at;
        return ts && new Date(ts).toISOString().split("T")[0] === dStr;
      }).length;
      const actualAssignedAndPreorders = dayAssigned + dayPreorders;

      const tCalls = dayEntry.isWorkingDay ? dayEntry.target_daily_calls : 0;
      const tFixed = dayEntry.isWorkingDay ? dayEntry.target_daily_training_fixed : 0;
      const tAttended = dayEntry.isWorkingDay ? dayEntry.target_daily_attended : 0;
      const tPreorders = dayEntry.isWorkingDay ? dayEntry.target_daily_preorders : 0;

      return {
        date: dStr,
        isWorkingDay: dayEntry.isWorkingDay,
        effectiveTargetDate: dayEntry.effectiveDate,
        targetCalls: tCalls,
        actualCalls,
        callsPct: tCalls > 0 ? Number(((actualCalls / tCalls) * 100).toFixed(1)) : 100,
        targetTrainingFixed: tFixed,
        actualTrainingFixed: actualFixed,
        trainingFixedPct: tFixed > 0 ? Number(((actualFixed / tFixed) * 100).toFixed(1)) : 100,
        targetAttended: tAttended,
        actualAttended: dayAttended,
        attendedPct: tAttended > 0 ? Number(((dayAttended / tAttended) * 100).toFixed(1)) : 100,
        targetPreorders: tPreorders,
        actualAssignedAndPreorders,
        preordersPct:
          tPreorders > 0 ? Number(((actualAssignedAndPreorders / tPreorders) * 100).toFixed(1)) : 100,
      };
    });

    // Pillar 3: Fleet Performance & Cash Collection (Salma Abouri, Mohamed Aziz, Mehdi Elyattouti)
    const collectionAttainment =
      collectionRecoveryRatePct >= targetMinCollectionRate
        ? Math.min(130, 100 + (collectionRecoveryRatePct - targetMinCollectionRate))
        : (collectionRecoveryRatePct / targetMinCollectionRate) * 100;
    const churnAttainment =
      monthlyChurnRatePct <= targetMaxChurnRate
        ? 100
        : Math.max(0, 100 - (monthlyChurnRatePct - targetMaxChurnRate) * 4);
    const maintAttainment =
      avgDaysMaintenance <= targetMaxMaintenanceDays
        ? 100
        : Math.max(0, (targetMaxMaintenanceDays / Math.max(1, avgDaysMaintenance)) * 100);
    const utilizationAttainment = Math.min(120, (fleetUtilizationRate / 85) * 100);
    const fleetPillarScorePct = Number(
      (
        0.3 * collectionAttainment +
        0.25 * churnAttainment +
        0.25 * maintAttainment +
        0.2 * utilizationAttainment
      ).toFixed(1)
    );

    // Pillar 4: Field Operations, Compliance & Support (Hamza Rassid & Ayoub Rassid)
    const completedFieldTasks = tasks.filter(
      (t) =>
        (t.status === "COMPLETED" || t.status === "Completed") &&
        new Date(t.created_at) >= startDate &&
        new Date(t.created_at) <= endDate
    );
    const missionHoursList = completedFieldTasks.map((t) => {
      if (t.recovery_duration_hours && t.recovery_duration_hours > 0) return t.recovery_duration_hours;
      if (t.completed_at) {
        return Math.max(
          0.2,
          (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60)
        );
      }
      return t.duration_hours || 2.0;
    });
    const avgMissionHours =
      missionHoursList.length > 0
        ? Number((missionHoursList.reduce((a, b) => a + b, 0) / missionHoursList.length).toFixed(1))
        : 2.1;

    const totalTicketsInPeriod = tickets.filter(
      (t) => new Date(t.created_at) >= startDate && new Date(t.created_at) <= endDate
    );
    const resolvedTicketsCount = tickets.filter((t) => t.status === "RESOLVED").length;
    const openTicketsCount = tickets.filter((t) => t.status !== "RESOLVED").length;
    const slaResolutionRate =
      tickets.length > 0 ? Math.round((resolvedTicketsCount / tickets.length) * 100) : 100;

    const missingDocsAttainment =
      avgDaysMissingDocs <= targetMaxMissingDocsDays
        ? 100
        : Math.max(0, (targetMaxMissingDocsDays / Math.max(1, avgDaysMissingDocs)) * 100);
    const missionSpeedAttainment =
      avgMissionHours <= targetMaxFieldMissionHours
        ? 100
        : Math.max(0, (targetMaxFieldMissionHours / Math.max(0.5, avgMissionHours)) * 100);
    const slaAttainment = Math.min(120, (slaResolutionRate / targetSlaResolutionRate) * 100);
    const fieldPillarScorePct = Number(
      (0.35 * missionSpeedAttainment + 0.35 * slaAttainment + 0.3 * missingDocsAttainment).toFixed(1)
    );

    // Composite Global Team Work Index
    const globalTeamWorkScorePct = Number(
      (
        0.25 * trafficPillarScorePct +
        0.25 * onboardingPillarScorePct +
        0.3 * fleetPillarScorePct +
        0.2 * fieldPillarScorePct
      ).toFixed(1)
    );

    // Per-Agent Breakdown for Acquisition & Onboarding
    const nourCalls = trafficCallsLeadsInPeriod.filter((l) =>
      (l.handled_by || "").toLowerCase().includes("nour")
    ).length;
    const nourFixed = trafficCallsLeadsInPeriod.filter(
      (l) => (l.handled_by || "").toLowerCase().includes("nour") && l.brand_status === "Training fixed"
    ).length;
    const kaoutarCalls = trafficCallsLeadsInPeriod.filter((l) =>
      (l.handled_by || "").toLowerCase().includes("kaoutar")
    ).length;
    const kaoutarFixed = trafficCallsLeadsInPeriod.filter(
      (l) => (l.handled_by || "").toLowerCase().includes("kaoutar") && l.brand_status === "Training fixed"
    ).length;

    const teamWorkPillars = [
      {
        id: "traffic",
        title: "1. Pôle Acquisition & Téléprospection",
        agents: "Nour Abouri & Kaoutar Ouardi",
        scorePct: trafficPillarScorePct,
        weightPct: 25,
        status:
          trafficPillarScorePct >= 85
            ? "ON_TARGET"
            : trafficPillarScorePct >= 60
            ? "AT_RISK"
            : "BREACHED",
        metrics: [
          {
            label: "Appels de Prospection (Période)",
            actual: `${prospectionCallsInPeriod} appels`,
            subtext: `Nour: ${nourCalls} · Kaoutar: ${kaoutarCalls}`,
            target: `${scaledCallsTarget} appels (${targetRangeInfo.formulas.calls})`,
          },
          {
            label: "Formations Fixées (Training Fixed)",
            actual: `${trainingsFixedInPeriod} fixées`,
            subtext: `Nour: ${nourFixed} · Kaoutar: ${kaoutarFixed}`,
            target: `${scaledTrainingFixedTarget} fixées (${targetRangeInfo.formulas.trainingFixed})`,
          },
          {
            label: "Taux de Conversion Appel → Formation",
            actual: `${trafficConversionRatePct}%`,
            subtext: `Cible standard GoCab : ≥ ${targetLeadConversionRate}%`,
            target: `≥ ${targetLeadConversionRate}%`,
          },
        ],
      },
      {
        id: "onboarding",
        title: "2. Pôle Formation, Précommandes & Affectation",
        agents: "Ayoub Gsaib",
        scorePct: onboardingPillarScorePct,
        weightPct: 25,
        status:
          onboardingPillarScorePct >= 85
            ? "ON_TARGET"
            : onboardingPillarScorePct >= 60
            ? "AT_RISK"
            : "BREACHED",
        metrics: [
          {
            label: "Présents en Formation (Attended + Pending)",
            actual: `${attendedInPeriod} présents`,
            subtext: `Sur ${trainingLeadsInPeriod.length} convoqués sur la période`,
            target: `${scaledAttendedTarget} présents (${targetRangeInfo.formulas.attended})`,
          },
          {
            label: "Véhicules Affectés & Précommandes (Période)",
            actual: `${totalAssignedAndPreordersInPeriod} (${assignedLeadsInPeriod.length} affect. + ${preorderLeadsInPeriod.length} précom.)`,
            subtext: `Cumul global : ${assignedLeadsAllTime.length} affectés · ${preorderLeadsAllTime.length} précommandes`,
            target: `${scaledPreordersAssignedTarget} (${targetRangeInfo.formulas.preorders})`,
          },
          {
            label: "Vélocité Parc (AVG Jours Véhicule Disponible)",
            actual: `${avgDaysAvailable} jours`,
            subtext: `${availableVehicles.length} véhicule(s) disponible(s) actuellement`,
            target: `≤ ${targetMaxAvailableDays} jour`,
          },
        ],
      },
      {
        id: "fleet",
        title: "3. Pôle Performance Flotte, Recouvrement & Rétention",
        agents: "Salma Abouri · Mohamed Aziz (75 véh.) · Mehdi Elyattouti (26 véh.)",
        scorePct: fleetPillarScorePct,
        weightPct: 30,
        status:
          fleetPillarScorePct >= 85
            ? "ON_TARGET"
            : fleetPillarScorePct >= 65
            ? "AT_RISK"
            : "BREACHED",
        metrics: [
          {
            label: "Taux de Recouvrement vs % Dette Non Recouvrée",
            actual: `${collectionRecoveryRatePct}% collecté (${collectionDebtRatePct}% dette)`,
            subtext: `Aziz: ${portfolioComparison.aziz.collectionRatePct}% · Mehdi: ${portfolioComparison.mehdi.collectionRatePct}%`,
            target: "50% – 60% / jour",
          },
          {
            label: "Taux de Churn & Pertes Chauffeurs Licenciés",
            actual: `${monthlyChurnRatePct}% (${churnCountInPeriod} dép.) · -${lostDebtInPeriodMAD.toLocaleString()} MAD`,
            subtext: `Perte cumulée historique : ${lostDebtAllTimeMAD.toLocaleString()} MAD (${firedWithDebtCountAllTime} cas)`,
            target: `≤ ${targetMaxChurnRate}% / mois`,
          },
          {
            label: "Immobilisation Maintenance & Rétention Chauffeur",
            actual: `${avgDaysMaintenance}j maint. · ${avgDaysAssignedToSameDriver}j/chauffeur`,
            subtext: `${inRepairVehicles.length} véhicules en maintenance (${maintenanceVehiclesPct}%)`,
            target: `≤ ${targetMaxMaintenanceDays}j maint.`,
          },
        ],
      },
      {
        id: "field",
        title: "4. Pôle Opérations Terrain, Documents & SLA Support",
        agents: "Hamza Rassid & Ayoub Rassid",
        scorePct: fieldPillarScorePct,
        weightPct: 20,
        status:
          fieldPillarScorePct >= 85
            ? "ON_TARGET"
            : fieldPillarScorePct >= 65
            ? "AT_RISK"
            : "BREACHED",
        metrics: [
          {
            label: "Délai Moyen d'Exécution Missions Terrain",
            actual: `${avgMissionHours} h`,
            subtext: `${completedFieldTasks.length} mission(s) complétée(s) sur la période`,
            target: `≤ ${targetMaxFieldMissionHours} h`,
          },
          {
            label: "AVG Jours Véhicule en Documents Manquants",
            actual: `${avgDaysMissingDocs} jours (${missingDocVehicles.length} véh. / ${missingDocsVehiclesPct}%)`,
            subtext: missingDocVehicles.map((v) => v.plate_number).join(", ") || "Aucun véhicule bloqué",
            target: `≤ ${targetMaxMissingDocsDays} jours`,
          },
          {
            label: "Taux de Résolution Tickets Support & Garage",
            actual: `${slaResolutionRate}% (${openTicketsCount} ouverts)`,
            subtext: `${resolvedTicketsCount} résolus sur ${tickets.length} tickets`,
            target: `≥ ${targetSlaResolutionRate}%`,
          },
        ],
      },
    ];

    // =========================================================================
    // 8. DIRECT EXPENSES & PER-VEHICLE FINANCIAL BREAKDOWN
    // =========================================================================
    const totalDirectExpensesMAD = expenses.reduce((sum, e) => sum + (e.amount_mad || 0), 0);
    const expensesByCategory: Record<string, number> = {};
    for (const exp of expenses) {
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + (exp.amount_mad || 0);
    }

    let totalOpportunityLossMAD = 0;

    const vehiclesFinancial = vehicles.map((v) => {
      const isActif = isActifStatus(v.status);
      const durationDays = parseStatusDurationDays(
        v.notes,
        v.total_downtime_days,
        isActif ? v.created_at : v.updated_at
      );

      let inactiveDays = isActif ? 0 : Math.round(durationDays);
      let driverTenureDays = 0;
      if (isActif && (v.driverProfile?.fullName || v.assigned_driver_name)) {
        driverTenureDays = Math.round(durationDays);
        const lastChurn = latestChurnDateByVehicleId.get(v.id);
        if (lastChurn) {
          const daysSinceChurn = Math.max(
            1,
            Math.round((now.getTime() - lastChurn.getTime()) / (1000 * 60 * 60 * 24))
          );
          driverTenureDays = Math.min(driverTenureDays, daysSinceChurn);
        }
      }

      const opportunityLossMAD = inactiveDays * DAILY_OPPORTUNITY_COST_MAD;
      totalOpportunityLossMAD += opportunityLossMAD;

      const directExpensesMAD = v.expenses.reduce((sum, e) => sum + (e.amount_mad || 0), 0);
      const totalCostMAD = directExpensesMAD + opportunityLossMAD;

      const rfCheck = redFlagsLookup.checkDriver({
        id: v.driverProfile?.id,
        name: v.driverProfile?.fullName || v.assigned_driver_name,
        phone: v.driverProfile?.phoneSanitized || v.assigned_driver_phone,
        cin: v.driverProfile?.cinNumber,
      });
      const is_driver_red_flagged = Boolean(v.driverProfile?.isRedFlagged || rfCheck.isRedFlagged);
      const driver_red_flag_reason = v.driverProfile?.redFlagReason || rfCheck.reason || null;

      const isMehdi =
        isMehdiPlate(v.plate_number) ||
        (v.assigned_collector || v.assigned_supervisor || "").toLowerCase().includes("mehdi");

      return {
        id: v.id,
        plate_number: v.plate_number,
        make_model: v.make_model,
        year: v.year,
        hub_city: v.hub_city,
        status: v.status,
        fleet_manager: isMehdi ? "Mehdi Elyattouti" : "Mohamed Aziz",
        driver_name: v.driverProfile?.fullName || v.assigned_driver_name || null,
        driver_phone: v.driverProfile?.phoneSanitized || v.assigned_driver_phone || null,
        is_driver_red_flagged,
        driver_red_flag_reason,
        driver_arrears_mad:
          morningPaymentsToday.length > 0
            ? (() => {
                const driverId = v.driverProfile?.id;
                const p = morningPaymentsToday.find((m) => m.driverId === driverId);
                if (p && p.morningBalance !== null && p.morningBalance !== undefined) {
                  return p.morningBalance < 0 ? Math.abs(p.morningBalance) : 0;
                }
                return v.driverProfile?.currentArrearsMAD || 0;
              })()
            : v.driverProfile?.currentArrearsMAD || 0,
        inactive_days: inactiveDays,
        driver_tenure_days: driverTenureDays,
        status_duration_days: Math.round(durationDays),
        opportunity_loss_mad: opportunityLossMAD,
        direct_expenses_mad: directExpensesMAD,
        total_cost_mad: totalCostMAD,
        expense_count: v.expenses.length,
        current_mileage: v.current_mileage,
      };
    });

    const dailyOpportunityLossBurnRate = totalInactiveCount * DAILY_OPPORTUNITY_COST_MAD;
    const totalFleetFinancialImpactMAD =
      totalDirectExpensesMAD + totalOpportunityLossMAD + lostDebtAllTimeMAD;

    // Legacy agentTargets structure kept for backward compatibility
    const kycCompletedLeads = leads.filter(
      (l) => l.has_cin && l.has_fiche_anthropometrique && l.has_confirmation_adresse && l.has_permis
    ).length;
    const kycRate = leads.length > 0 ? Math.round((kycCompletedLeads / leads.length) * 100) : 0;
    const conversionRate = leads.length > 0 ? Math.round((assignedLeadsAllTime.length / leads.length) * 100) : 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const inspectedVehicleIds = new Set(
      inspections.filter((i) => new Date(i.inspectedAt) >= thirtyDaysAgo).map((i) => i.vehicleId)
    );
    const inspectionRate = totalFleet > 0 ? Math.round((inspectedVehicleIds.size / totalFleet) * 100) : 0;
    const gpsConnectedCount = vehicles.filter((v) => v.isGpsConnected).length;
    const gpsRate = totalFleet > 0 ? Math.round((gpsConnectedCount / totalFleet) * 100) : 0;

    const agentTargets = {
      leadAcquisition: {
        role: "LEAD_ACQUISITION_JR",
        title: "Acquisition & Téléprospection",
        agentName: "Nour Abouri & Kaoutar Ouardi",
        kpis: [
          {
            name: "Appels de Prospection (Période)",
            actual: prospectionCallsInPeriod,
            target: scaledCallsTarget,
            unit: "appels",
            isPercentage: false,
            status: prospectionCallsInPeriod >= scaledCallsTarget ? "ON_TARGET" : "AT_RISK",
          },
          {
            name: "Formations Fixées (Période)",
            actual: trainingsFixedInPeriod,
            target: scaledTrainingFixedTarget,
            unit: "formations",
            isPercentage: false,
            status: trainingsFixedInPeriod >= scaledTrainingFixedTarget ? "ON_TARGET" : "AT_RISK",
          },
          {
            name: "Taux de Conversion Appel → Formation",
            actual: trafficConversionRatePct,
            target: 30,
            unit: "%",
            isPercentage: true,
            status: trafficConversionRatePct >= 30 ? "ON_TARGET" : "AT_RISK",
          },
        ],
      },
      onboardingSpecialist: {
        role: "ONBOARDING_SPECIALIST",
        title: "Formation, Précommandes & Affectation",
        agentName: "Ayoub Gsaib",
        kpis: [
          {
            name: "Présents en Formation (incl. Pending)",
            actual: attendedInPeriod,
            target: scaledAttendedTarget,
            unit: "candidats",
            isPercentage: false,
            status: attendedInPeriod >= scaledAttendedTarget ? "ON_TARGET" : "AT_RISK",
          },
          {
            name: "Véhicules Affectés & Précommandes",
            actual: totalAssignedAndPreordersInPeriod,
            target: scaledPreordersAssignedTarget,
            unit: "chauffeurs",
            isPercentage: false,
            status:
              totalAssignedAndPreordersInPeriod >= scaledPreordersAssignedTarget
                ? "ON_TARGET"
                : "AT_RISK",
          },
          {
            name: "AVG Jours Véhicule Disponible",
            actual: avgDaysAvailable,
            target: targetMaxAvailableDays,
            unit: "jours",
            isPercentage: false,
            status: avgDaysAvailable <= targetMaxAvailableDays ? "ON_TARGET" : "BREACHED",
          },
        ],
      },
      fleetPerformance: {
        role: "FLEET_PERF_MANAGER",
        title: "Performance Flotte & Recouvrement",
        agentName: "Salma Abouri · Mohamed Aziz · Mehdi Elyattouti",
        kpis: [
          {
            name: "Taux d'Utilisation Flotte Active",
            actual: fleetUtilizationRate,
            target: 85,
            unit: "%",
            isPercentage: true,
            status: fleetUtilizationRate >= 85 ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Taux de Recouvrement Cash",
            actual: collectionRecoveryRatePct,
            target: targetMinCollectionRate,
            unit: "%",
            isPercentage: true,
            status: collectionRecoveryRatePct >= targetMinCollectionRate ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Taux de Churn Mensuel",
            actual: monthlyChurnRatePct,
            target: targetMaxChurnRate,
            unit: "%",
            isPercentage: true,
            status: monthlyChurnRatePct <= targetMaxChurnRate ? "ON_TARGET" : "BREACHED",
          },
        ],
      },
      fieldSupervisor: {
        role: "FIELD_SUPERVISOR",
        title: "Opérations Terrain & Documents",
        agentName: "Hamza Rassid & Ayoub Rassid",
        kpis: [
          {
            name: "AVG Jours Documents Manquants",
            actual: avgDaysMissingDocs,
            target: targetMaxMissingDocsDays,
            unit: "jours",
            isPercentage: false,
            status: avgDaysMissingDocs <= targetMaxMissingDocsDays ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Taux de Résolution SLA Support",
            actual: slaResolutionRate,
            target: targetSlaResolutionRate,
            unit: "%",
            isPercentage: true,
            status: slaResolutionRate >= targetSlaResolutionRate ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Télématique & GPS Actifs",
            actual: gpsRate,
            target: 100,
            unit: "%",
            isPercentage: true,
            status: gpsRate >= 95 ? "ON_TARGET" : "AT_RISK",
          },
        ],
      },
    };

    return NextResponse.json({
      period: {
        preset: periodPreset,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        workingDays,
        calendarDays,
      },
      summary: {
        total_fleet: totalFleet,
        active_vehicles: totalActiveCount,
        available_vehicles: availableVehicles.length,
        in_repair_vehicles: inRepairVehicles.length,
        missing_docs_vehicles: missingDocVehicles.length,
        police_impounded_vehicles: policeImpoundedVehicles.length,
        impounded_vehicles: impoundedVehicles.length,
        inactive_vehicles: totalInactiveCount,

        // Fleet Status Percentages (%)
        utilization_rate: fleetUtilizationRate,
        available_vehicles_pct: availableVehiclesPct,
        maintenance_vehicles_pct: maintenanceVehiclesPct,
        missing_docs_vehicles_pct: missingDocsVehiclesPct,
        police_impounded_vehicles_pct: policeImpoundedVehiclesPct,

        // Fleet Cycle & Tenure Durations (AVG Days)
        avg_days_assigned_same_driver: avgDaysAssignedToSameDriver,
        median_days_assigned_same_driver: medianDaysAssignedToSameDriver,
        tenure_cohorts: tenureCohorts,
        avg_days_available: avgDaysAvailable,
        avg_days_missing_docs: avgDaysMissingDocs,
        avg_days_maintenance: avgDaysMaintenance,
        target_max_available_days: targetMaxAvailableDays,
        target_max_missing_docs_days: targetMaxMissingDocsDays,
        target_max_maintenance_days: targetMaxMaintenanceDays,

        // Assigned Vehicles & Preorders (in Period & All-Time)
        assigned_vehicles_in_period: assignedLeadsInPeriod.length,
        preorders_in_period: preorderLeadsInPeriod.length,
        assigned_and_preorders_in_period: totalAssignedAndPreordersInPeriod,
        preorder_amount_in_period_mad: preorderAmountInPeriodMAD,
        assigned_vehicles_all_time: assignedLeadsAllTime.length,
        preorders_all_time: preorderLeadsAllTime.length,
        preorder_amount_all_time_mad: preorderAmountAllTimeMAD,
        prospection_calls_in_period: prospectionCallsInPeriod,
        trainings_fixed_in_period: trainingsFixedInPeriod,
        attended_in_period: attendedInPeriod,
        onboarding_conversion_rate_pct: onboardingConversionRatePct,

        // Churn & Lost Money After Firing Without Collecting Debt
        churn_count_in_period: churnCountInPeriod,
        churn_count_all_time: churnCountAllTime,
        period_churn_rate_pct: periodChurnRatePct,
        monthly_churn_rate_pct: monthlyChurnRatePct,
        target_max_churn_rate_pct: targetMaxChurnRate,
        lost_debt_fired_drivers_period_mad: Math.round(lostDebtInPeriodMAD),
        lost_debt_fired_drivers_all_time_mad: Math.round(lostDebtAllTimeMAD),
        fired_with_debt_count_period: firedWithDebtCountInPeriod,
        fired_with_debt_count_all_time: firedWithDebtCountAllTime,
        avg_lost_debt_per_fired_driver_mad: avgLostDebtPerFiredDriverMAD,

        // Collection & Debt Metrics (% of Collection Debt)
        period_expected_collection_mad: Math.round(periodExpectedTargetMAD),
        period_collected_mad: Math.round(periodCollectedMAD),
        period_uncollected_debt_mad: Math.round(uncollectedDebtMAD),
        collection_rate_pct: collectionRecoveryRatePct,
        collection_debt_pct: collectionDebtRatePct,
        target_min_collection_rate_pct: targetMinCollectionRate,
        target_max_collection_rate_pct: targetMaxCollectionRate,
        total_driver_arrears_mad: Math.round(activeDriverArrearsMAD),
        total_debt_exposure_mad: Math.round(totalDebtExposureMAD),
        bad_debt_share_pct: badDebtShareOfExposurePct,

        // Financial Impact & Opportunity Loss
        daily_opportunity_cost_per_vehicle: DAILY_OPPORTUNITY_COST_MAD,
        daily_opportunity_loss_burn_rate: dailyOpportunityLossBurnRate,
        total_opportunity_loss_mad: totalOpportunityLossMAD,
        total_direct_expenses_mad: totalDirectExpensesMAD,
        total_fleet_financial_impact_mad: Math.round(totalFleetFinancialImpactMAD),
        expenses_by_category: expensesByCategory,

        // Global Team Work Composite Score
        global_team_work_score_pct: globalTeamWorkScorePct,
        traffic_pillar_score_pct: trafficPillarScorePct,
        onboarding_pillar_score_pct: onboardingPillarScorePct,
        fleet_pillar_score_pct: fleetPillarScorePct,
        field_pillar_score_pct: fieldPillarScorePct,
      },
      teamWorkPillars,
      dailyTargets: {
        workingDays: targetRangeInfo.workingDays,
        hasMultipleTargetRegimes: targetRangeInfo.hasMultipleTargetRegimes,
        avgDailyCalls: targetRangeInfo.avgDailyCalls,
        avgDailyTraining: targetRangeInfo.avgDailyTraining,
        avgDailyAttended: targetRangeInfo.avgDailyAttended,
        avgDailyPreorders: targetRangeInfo.avgDailyPreorders,
        scaledCallsTarget: targetRangeInfo.scaledCallsTarget,
        scaledTrainingTarget: targetRangeInfo.scaledTrainingTarget,
        scaledAttendedTarget: targetRangeInfo.scaledAttendedTarget,
        scaledPreordersTarget: targetRangeInfo.scaledPreordersTarget,
        formulas: targetRangeInfo.formulas,
        segments: targetRangeInfo.segments,
        dailyPerformance: dailyTargetPerformance,
        activeSnapshot: targetRangeInfo.activeSnapshot,
        history: historyList,
      },
      portfolioComparison,
      churnedDriversLedger: enrichedChurnLedger,
      agentTargets,
      vehicles: vehiclesFinancial,
    });
  } catch (error: any) {
    console.error("GET /api/reports/financial error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate executive financial report" },
      { status: 500 }
    );
  }
}
