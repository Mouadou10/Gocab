/**
 * target-history.ts
 *
 * Manages date-effective daily & department targets across GoCab operations.
 * Allows targets to change on a daily basis depending on operational needs,
 * ensuring every single day in any selected period is evaluated against the
 * exact target that was fixed for that specific day.
 */

import { getMoroccanWorkingDays, isMoroccanHoliday } from "@/lib/moroccoCalendar";

export interface TargetSnapshot {
  effective_date: string; // "YYYY-MM-DD"
  target_daily_calls: number;
  target_daily_training_fixed: number;
  target_daily_attended: number;
  target_daily_preorders: number;
  target_daily_tasks?: number;
  target_lead_conversion_rate?: number;
  target_training_showup_rate?: number;
  target_preorder_conversion_rate?: number;
  target_min_collection_rate?: number;
  target_collection_rate?: number;
  target_monthly_churn_rate?: number;
  target_max_downtime_days?: number;
  target_avg_available_days?: number;
  target_max_missing_docs_days?: number;
  target_max_vidange_hours?: number;
  target_max_field_mission_hours?: number;
  target_sla_resolution_rate?: number;
  target_monthly_inspection_rate?: number;
  target_active_fleet_rate?: number;
  [key: string]: any;
}

export interface TargetSegment {
  effectiveDate: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  dailyCalls: number;
  dailyTrainingFixed: number;
  dailyAttended: number;
  dailyPreorders: number;
  dailyTasks: number;
  totalCalls: number;
  totalTrainingFixed: number;
  totalAttended: number;
  totalPreorders: number;
  totalTasks: number;
}

export interface DailyTargetEntry {
  date: string;
  isWorkingDay: boolean;
  effectiveDate: string;
  target_daily_calls: number;
  target_daily_training_fixed: number;
  target_daily_attended: number;
  target_daily_preorders: number;
  target_daily_tasks: number;
  target_lead_conversion_rate: number;
  target_training_showup_rate: number;
  target_preorder_conversion_rate: number;
}

export const DEFAULT_TARGET_HISTORY: TargetSnapshot[] = [
  {
    effective_date: "2026-10-01",
    target_daily_calls: 50,
    target_daily_training_fixed: 15,
    target_daily_attended: 10,
    target_daily_preorders: 4,
    target_daily_tasks: 10,
    target_lead_conversion_rate: 30,
    target_training_showup_rate: 65,
    target_preorder_conversion_rate: 25,
    target_min_collection_rate: 50,
    target_collection_rate: 60,
    target_monthly_churn_rate: 20,
    target_max_downtime_days: 10,
    target_avg_available_days: 1.0,
    target_max_missing_docs_days: 3.0,
    target_max_vidange_hours: 1.0,
    target_max_field_mission_hours: 3.0,
    target_sla_resolution_rate: 95,
    target_monthly_inspection_rate: 90,
    target_active_fleet_rate: 85,
  },
  {
    effective_date: "2026-10-21",
    target_daily_calls: 80,
    target_daily_training_fixed: 24,
    target_daily_attended: 16,
    target_daily_preorders: 6,
    target_daily_tasks: 10,
    target_lead_conversion_rate: 30,
    target_training_showup_rate: 65,
    target_preorder_conversion_rate: 25,
    target_min_collection_rate: 50,
    target_collection_rate: 60,
    target_monthly_churn_rate: 20,
    target_max_downtime_days: 10,
    target_avg_available_days: 1.0,
    target_max_missing_docs_days: 3.0,
    target_max_vidange_hours: 1.0,
    target_max_field_mission_hours: 3.0,
    target_sla_resolution_rate: 95,
    target_monthly_inspection_rate: 90,
    target_active_fleet_rate: 85,
  },
  {
    effective_date: "2026-10-22",
    target_daily_calls: 133,
    target_daily_training_fixed: 40,
    target_daily_attended: 26,
    target_daily_preorders: 10,
    target_daily_tasks: 10,
    target_lead_conversion_rate: 30,
    target_training_showup_rate: 65,
    target_preorder_conversion_rate: 25,
    target_min_collection_rate: 50,
    target_collection_rate: 60,
    target_monthly_churn_rate: 20,
    target_max_downtime_days: 10,
    target_avg_available_days: 1.0,
    target_max_missing_docs_days: 3.0,
    target_max_vidange_hours: 1.0,
    target_max_field_mission_hours: 3.0,
    target_sla_resolution_rate: 95,
    target_monthly_inspection_rate: 90,
    target_active_fleet_rate: 85,
  },
];

function normalizeSnapshot(raw: any, fallback?: any): TargetSnapshot {
  const calls = Number(raw?.target_daily_calls ?? fallback?.target_daily_calls) || 50;
  const fixed =
    Number(raw?.target_daily_training_fixed ?? fallback?.target_daily_training_fixed) ||
    Math.round(calls * 0.3);
  const attended =
    Number(raw?.target_daily_attended ?? fallback?.target_daily_attended) ||
    Math.round(fixed * 0.65);
  const preorders =
    Number(raw?.target_daily_preorders ?? fallback?.target_daily_preorders) ||
    Math.round(fixed * 0.25);

  return {
    ...fallback,
    ...raw,
    effective_date: String(raw?.effective_date || new Date().toISOString().split("T")[0]).split("T")[0],
    target_daily_calls: calls,
    target_daily_training_fixed: fixed,
    target_daily_attended: attended,
    target_daily_preorders: preorders,
    target_daily_tasks: Number(raw?.target_daily_tasks ?? fallback?.target_daily_tasks) || 10,
    target_lead_conversion_rate:
      Number(raw?.target_lead_conversion_rate ?? fallback?.target_lead_conversion_rate) || 30,
    target_training_showup_rate:
      Number(raw?.target_training_showup_rate ?? fallback?.target_training_showup_rate) || 65,
    target_preorder_conversion_rate:
      Number(raw?.target_preorder_conversion_rate ?? fallback?.target_preorder_conversion_rate) || 25,
    target_min_collection_rate:
      Number(raw?.target_min_collection_rate ?? fallback?.target_min_collection_rate) || 50,
    target_collection_rate:
      Number(raw?.target_collection_rate ?? fallback?.target_collection_rate) || 60,
    target_monthly_churn_rate:
      Number(raw?.target_monthly_churn_rate ?? fallback?.target_monthly_churn_rate) || 20,
    target_max_downtime_days:
      Number(raw?.target_max_downtime_days ?? fallback?.target_max_downtime_days) || 10,
    target_avg_available_days:
      Number(raw?.target_avg_available_days ?? fallback?.target_avg_available_days) || 1.0,
    target_max_missing_docs_days:
      Number(raw?.target_max_missing_docs_days ?? fallback?.target_max_missing_docs_days) || 3.0,
    target_max_vidange_hours:
      Number(raw?.target_max_vidange_hours ?? fallback?.target_max_vidange_hours) || 1.0,
    target_max_field_mission_hours:
      Number(raw?.target_max_field_mission_hours ?? fallback?.target_max_field_mission_hours) || 3.0,
    target_sla_resolution_rate:
      Number(raw?.target_sla_resolution_rate ?? fallback?.target_sla_resolution_rate) || 95,
    target_monthly_inspection_rate:
      Number(raw?.target_monthly_inspection_rate ?? fallback?.target_monthly_inspection_rate) || 90,
    target_active_fleet_rate:
      Number(raw?.target_active_fleet_rate ?? fallback?.target_active_fleet_rate) || 85,
  };
}

/**
 * Parses target history from raw DB setting or fallback, merging baseline history
 * so historical days always retain their fixed target.
 */
export function parseTargetHistory(
  rawHistory: any,
  fallbackCurrentTargets?: any
): TargetSnapshot[] {
  let list: any[] = [];
  if (typeof rawHistory === "string") {
    try {
      const parsed = JSON.parse(rawHistory);
      if (Array.isArray(parsed)) list = parsed;
    } catch {}
  } else if (Array.isArray(rawHistory)) {
    list = rawHistory;
  }

  const byDate = new Map<string, TargetSnapshot>();

  // Seed baseline history first so historical dates before custom changes are preserved
  for (const base of DEFAULT_TARGET_HISTORY) {
    byDate.set(base.effective_date, normalizeSnapshot(base, fallbackCurrentTargets));
  }

  // Overlay saved history snapshots
  for (const item of list) {
    if (item && item.effective_date) {
      const d = String(item.effective_date).split("T")[0];
      byDate.set(d, normalizeSnapshot({ ...item, effective_date: d }, fallbackCurrentTargets));
    }
  }

  // If fallbackCurrentTargets has an explicit effective_date or differs from the latest snapshot
  if (fallbackCurrentTargets && fallbackCurrentTargets.target_daily_calls) {
    const sortedSoFar = Array.from(byDate.values()).sort((a, b) =>
      a.effective_date.localeCompare(b.effective_date)
    );
    const latest = sortedSoFar[sortedSoFar.length - 1];
    const targetCalls = Number(fallbackCurrentTargets.target_daily_calls);
    const targetFixed =
      Number(fallbackCurrentTargets.target_daily_training_fixed) || Math.round(targetCalls * 0.3);

    if (
      !latest ||
      latest.target_daily_calls !== targetCalls ||
      latest.target_daily_training_fixed !== targetFixed
    ) {
      const effDate =
        fallbackCurrentTargets.effective_date ||
        new Date().toISOString().split("T")[0];
      byDate.set(
        effDate,
        normalizeSnapshot(
          { ...fallbackCurrentTargets, effective_date: effDate },
          fallbackCurrentTargets
        )
      );
    }
  }

  return Array.from(byDate.values()).sort((a, b) =>
    a.effective_date.localeCompare(b.effective_date)
  );
}

/**
 * Finds the active target snapshot for a specific date (YYYY-MM-DD).
 */
export function getTargetForDate(
  dateInput: Date | string,
  history: TargetSnapshot[],
  fallback?: any
): TargetSnapshot {
  const dateStr =
    typeof dateInput === "string"
      ? dateInput.split("T")[0]
      : dateInput.toISOString().split("T")[0];

  const sorted = parseTargetHistory(history, fallback);

  // Look for the latest snapshot that was effective on or before dateStr
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].effective_date <= dateStr) {
      return sorted[i];
    }
  }

  return sorted[0] || normalizeSnapshot(DEFAULT_TARGET_HISTORY[0], fallback);
}

/**
 * Resolves aggregated targets across a date range [startDate, endDate],
 * properly weighting each Moroccan working day by its active daily target snapshot.
 */
export function getTargetsForRange(
  startInput: Date | string,
  endInput: Date | string,
  history: TargetSnapshot[],
  fallback?: any
) {
  const sDate =
    typeof startInput === "string"
      ? new Date(startInput.split("T")[0] + "T00:00:00.000Z")
      : new Date(startInput);
  const eDate =
    typeof endInput === "string"
      ? new Date(endInput.split("T")[0] + "T23:59:59.999Z")
      : new Date(endInput);

  const startYMD = sDate.toISOString().split("T")[0];
  const endYMD = eDate.toISOString().split("T")[0];

  const parsedHistory = parseTargetHistory(history, fallback);

  // Iterate over each calendar day between sDate and eDate
  let totalCalls = 0;
  let totalTraining = 0;
  let totalAttended = 0;
  let totalPreorders = 0;
  let totalTasks = 0;
  let workDayCount = 0;

  let sumLeadConvRate = 0;
  let sumShowupRate = 0;
  let sumPreorderConvRate = 0;
  let sumMinCollectionRate = 0;
  let sumMaxCollectionRate = 0;
  let sumMaxChurnRate = 0;
  let sumMaxMaintenanceDays = 0;
  let sumMaxAvailableDays = 0;
  let sumMaxMissingDocsDays = 0;
  let sumMaxVidangeHours = 0;
  let sumMaxFieldMissionHours = 0;
  let sumSlaResolutionRate = 0;
  let sumAttestationRate = 0;
  let sumActiveFleetRate = 0;

  const segmentsMap: TargetSegment[] = [];
  const dailySchedule: DailyTargetEntry[] = [];

  const cur = new Date(sDate);
  cur.setUTCHours(12, 0, 0, 0);

  const endUtc = new Date(eDate);
  endUtc.setUTCHours(12, 0, 0, 0);

  while (cur <= endUtc) {
    const curYMD = cur.toISOString().split("T")[0];
    const dayOfWeek = cur.getUTCDay(); // 0 = Sun, 6 = Sat
    const holidayCheck = isMoroccanHoliday(cur);
    const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5 && !holidayCheck.isHoliday;

    const dayTarget = getTargetForDate(curYMD, parsedHistory, fallback);

    dailySchedule.push({
      date: curYMD,
      isWorkingDay,
      effectiveDate: dayTarget.effective_date,
      target_daily_calls: dayTarget.target_daily_calls,
      target_daily_training_fixed: dayTarget.target_daily_training_fixed,
      target_daily_attended: dayTarget.target_daily_attended,
      target_daily_preorders: dayTarget.target_daily_preorders,
      target_daily_tasks: dayTarget.target_daily_tasks || 10,
      target_lead_conversion_rate: dayTarget.target_lead_conversion_rate || 30,
      target_training_showup_rate: dayTarget.target_training_showup_rate || 65,
      target_preorder_conversion_rate: dayTarget.target_preorder_conversion_rate || 25,
    });

    if (isWorkingDay) {
      workDayCount++;
      const dCalls = dayTarget.target_daily_calls;
      const dFixed = dayTarget.target_daily_training_fixed;
      const dAttended = dayTarget.target_daily_attended;
      const dPreorders = dayTarget.target_daily_preorders;
      const dTasks = dayTarget.target_daily_tasks || 10;

      totalCalls += dCalls;
      totalTraining += dFixed;
      totalAttended += dAttended;
      totalPreorders += dPreorders;
      totalTasks += dTasks;

      sumLeadConvRate += dayTarget.target_lead_conversion_rate || 30;
      sumShowupRate += dayTarget.target_training_showup_rate || 65;
      sumPreorderConvRate += dayTarget.target_preorder_conversion_rate || 25;
      sumMinCollectionRate += dayTarget.target_min_collection_rate || 50;
      sumMaxCollectionRate += dayTarget.target_collection_rate || 60;
      sumMaxChurnRate += dayTarget.target_monthly_churn_rate || 20;
      sumMaxMaintenanceDays += dayTarget.target_max_downtime_days || 10;
      sumMaxAvailableDays += dayTarget.target_avg_available_days || 1.0;
      sumMaxMissingDocsDays += dayTarget.target_max_missing_docs_days || 3.0;
      sumMaxVidangeHours += dayTarget.target_max_vidange_hours || 1.0;
      sumMaxFieldMissionHours += dayTarget.target_max_field_mission_hours || 3.0;
      sumSlaResolutionRate += dayTarget.target_sla_resolution_rate || 95;
      sumAttestationRate += dayTarget.target_monthly_inspection_rate || 90;
      sumActiveFleetRate += dayTarget.target_active_fleet_rate || 85;

      const lastSeg = segmentsMap[segmentsMap.length - 1];
      if (
        lastSeg &&
        lastSeg.dailyCalls === dCalls &&
        lastSeg.dailyTrainingFixed === dFixed &&
        lastSeg.dailyAttended === dAttended &&
        lastSeg.dailyPreorders === dPreorders
      ) {
        lastSeg.endDate = curYMD;
        lastSeg.workingDays += 1;
        lastSeg.totalCalls += dCalls;
        lastSeg.totalTrainingFixed += dFixed;
        lastSeg.totalAttended += dAttended;
        lastSeg.totalPreorders += dPreorders;
        lastSeg.totalTasks += dTasks;
      } else {
        segmentsMap.push({
          effectiveDate: dayTarget.effective_date,
          startDate: curYMD,
          endDate: curYMD,
          workingDays: 1,
          dailyCalls: dCalls,
          dailyTrainingFixed: dFixed,
          dailyAttended: dAttended,
          dailyPreorders: dPreorders,
          dailyTasks: dTasks,
          totalCalls: dCalls,
          totalTrainingFixed: dFixed,
          totalAttended: dAttended,
          totalPreorders: dPreorders,
          totalTasks: dTasks,
        });
      }
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Fallback if no working days were counted (e.g. weekend single day selected)
  if (workDayCount === 0) {
    const fallbackTarget = getTargetForDate(endYMD, parsedHistory, fallback);
    totalCalls = fallbackTarget.target_daily_calls;
    totalTraining = fallbackTarget.target_daily_training_fixed;
    totalAttended = fallbackTarget.target_daily_attended;
    totalPreorders = fallbackTarget.target_daily_preorders;
    totalTasks = fallbackTarget.target_daily_tasks || 10;
    workDayCount = 1;

    sumLeadConvRate = fallbackTarget.target_lead_conversion_rate || 30;
    sumShowupRate = fallbackTarget.target_training_showup_rate || 65;
    sumPreorderConvRate = fallbackTarget.target_preorder_conversion_rate || 25;
    sumMinCollectionRate = fallbackTarget.target_min_collection_rate || 50;
    sumMaxCollectionRate = fallbackTarget.target_collection_rate || 60;
    sumMaxChurnRate = fallbackTarget.target_monthly_churn_rate || 20;
    sumMaxMaintenanceDays = fallbackTarget.target_max_downtime_days || 10;
    sumMaxAvailableDays = fallbackTarget.target_avg_available_days || 1.0;
    sumMaxMissingDocsDays = fallbackTarget.target_max_missing_docs_days || 3.0;
    sumMaxVidangeHours = fallbackTarget.target_max_vidange_hours || 1.0;
    sumMaxFieldMissionHours = fallbackTarget.target_max_field_mission_hours || 3.0;
    sumSlaResolutionRate = fallbackTarget.target_sla_resolution_rate || 95;
    sumAttestationRate = fallbackTarget.target_monthly_inspection_rate || 90;
    sumActiveFleetRate = fallbackTarget.target_active_fleet_rate || 85;

    segmentsMap.push({
      effectiveDate: fallbackTarget.effective_date,
      startDate: startYMD,
      endDate: endYMD,
      workingDays: 1,
      dailyCalls: totalCalls,
      dailyTrainingFixed: totalTraining,
      dailyAttended: totalAttended,
      dailyPreorders: totalPreorders,
      dailyTasks: totalTasks,
      totalCalls,
      totalTrainingFixed: totalTraining,
      totalAttended,
      totalPreorders,
      totalTasks,
    });
  }

  const latestTarget = getTargetForDate(endYMD, parsedHistory, fallback);
  const hasMultipleTargetRegimes = segmentsMap.length > 1;

  const formatSegmentFormula = (
    getter: (seg: TargetSegment) => number,
    avgDaily: number
  ) => {
    if (!hasMultipleTargetRegimes) {
      return `${avgDaily}/j`;
    }
    const parts = segmentsMap.map((s) => `${s.workingDays}j×${getter(s)}`);
    return `moy. ${avgDaily}/j (${parts.join(" + ")})`;
  };

  const avgDailyCalls = Number((totalCalls / workDayCount).toFixed(1));
  const avgDailyTraining = Number((totalTraining / workDayCount).toFixed(1));
  const avgDailyAttended = Number((totalAttended / workDayCount).toFixed(1));
  const avgDailyPreorders = Number((totalPreorders / workDayCount).toFixed(1));

  return {
    workingDays: workDayCount,
    dailyCallsTarget: Math.round(totalCalls / workDayCount),
    dailyTrainingTarget: Math.round(totalTraining / workDayCount),
    dailyAttendedTarget: Math.round(totalAttended / workDayCount),
    dailyPreordersTarget: Math.round(totalPreorders / workDayCount),
    avgDailyCalls,
    avgDailyTraining,
    avgDailyAttended,
    avgDailyPreorders,
    scaledCallsTarget: totalCalls,
    scaledTrainingTarget: totalTraining,
    scaledAttendedTarget: totalAttended,
    scaledPreordersTarget: totalPreorders,
    scaledTasksTarget: totalTasks,
    targetLeadConversionRate: Number((sumLeadConvRate / workDayCount).toFixed(1)),
    targetTrainingShowupRate: Number((sumShowupRate / workDayCount).toFixed(1)),
    targetPreorderConversionRate: Number((sumPreorderConvRate / workDayCount).toFixed(1)),
    targetMinCollectionRate: Number((sumMinCollectionRate / workDayCount).toFixed(1)),
    targetMaxCollectionRate: Number((sumMaxCollectionRate / workDayCount).toFixed(1)),
    targetMaxChurnRate: Number((sumMaxChurnRate / workDayCount).toFixed(1)),
    targetMaxMaintenanceDays: Number((sumMaxMaintenanceDays / workDayCount).toFixed(1)),
    targetMaxAvailableDays: Number((sumMaxAvailableDays / workDayCount).toFixed(1)),
    targetMaxMissingDocsDays: Number((sumMaxMissingDocsDays / workDayCount).toFixed(1)),
    targetMaxVidangeHours: Number((sumMaxVidangeHours / workDayCount).toFixed(1)),
    targetMaxFieldMissionHours: Number((sumMaxFieldMissionHours / workDayCount).toFixed(1)),
    targetSlaResolutionRate: Number((sumSlaResolutionRate / workDayCount).toFixed(1)),
    targetAttestationRate: Number((sumAttestationRate / workDayCount).toFixed(1)),
    targetActiveFleetRate: Number((sumActiveFleetRate / workDayCount).toFixed(1)),
    activeSnapshot: latestTarget,
    hasMultipleTargetRegimes,
    segments: segmentsMap,
    dailySchedule,
    formulas: {
      calls: formatSegmentFormula((s) => s.dailyCalls, avgDailyCalls),
      trainingFixed: formatSegmentFormula((s) => s.dailyTrainingFixed, avgDailyTraining),
      attended: formatSegmentFormula((s) => s.dailyAttended, avgDailyAttended),
      preorders: formatSegmentFormula((s) => s.dailyPreorders, avgDailyPreorders),
    },
  };
}
