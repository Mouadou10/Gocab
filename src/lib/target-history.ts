/**
 * target-history.ts
 * 
 * Manages date-effective department targets across GoCab operations.
 * Allows past periods (e.g. yesterday) to retain the exact operational target
 * that was fixed at that time, preventing new targets set today from retroactively
 * distorting past KPI performance evaluations.
 */

import { getMoroccanWorkingDays } from "@/lib/moroccoCalendar";

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
  [key: string]: any;
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
  },
];

/**
 * Parses target history from raw DB setting or fallback.
 */
export function parseTargetHistory(
  rawHistory: any,
  fallbackCurrentTargets?: any
): TargetSnapshot[] {
  let list: TargetSnapshot[] = [];
  if (typeof rawHistory === "string") {
    try {
      const parsed = JSON.parse(rawHistory);
      if (Array.isArray(parsed)) list = parsed;
    } catch {}
  } else if (Array.isArray(rawHistory)) {
    list = rawHistory;
  }

  if (list.length === 0) {
    list = [...DEFAULT_TARGET_HISTORY];
    if (fallbackCurrentTargets?.target_daily_calls) {
      const today = new Date().toISOString().split("T")[0];
      const existingToday = list.find((s) => s.effective_date === today);
      if (existingToday) {
        Object.assign(existingToday, fallbackCurrentTargets);
      } else {
        list.push({
          effective_date: today,
          target_daily_calls: Number(fallbackCurrentTargets.target_daily_calls) || 133,
          target_daily_training_fixed: Number(fallbackCurrentTargets.target_daily_training_fixed) || 40,
          target_daily_attended: Number(fallbackCurrentTargets.target_daily_attended) || 26,
          target_daily_preorders: Number(fallbackCurrentTargets.target_daily_preorders) || 10,
          ...fallbackCurrentTargets,
        });
      }
    }
  }

  // Ensure sorted chronologically by effective_date
  return list.sort((a, b) => a.effective_date.localeCompare(b.effective_date));
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

  return sorted[0] || DEFAULT_TARGET_HISTORY[0];
}

/**
 * Resolves aggregated targets across a date range [startDate, endDate],
 * properly weighting each working day by its active target snapshot.
 */
export function getTargetsForRange(
  startInput: Date | string,
  endInput: Date | string,
  history: TargetSnapshot[],
  fallback?: any
) {
  const sDate = typeof startInput === "string" ? new Date(startInput + "T00:00:00.000Z") : new Date(startInput);
  const eDate = typeof endInput === "string" ? new Date(endInput + "T23:59:59.999Z") : new Date(endInput);

  const startYMD = sDate.toISOString().split("T")[0];
  const endYMD = eDate.toISOString().split("T")[0];

  const moroccoDays = getMoroccanWorkingDays(sDate, eDate);
  const workingDays = Math.max(1, moroccoDays.workingDays);

  const parsedHistory = parseTargetHistory(history, fallback);

  // If start and end are on the same calendar day, take that day's target directly
  if (startYMD === endYMD) {
    const singleDayTarget = getTargetForDate(startYMD, parsedHistory, fallback);
    return {
      workingDays: 1,
      dailyCallsTarget: singleDayTarget.target_daily_calls,
      dailyTrainingTarget: singleDayTarget.target_daily_training_fixed,
      dailyAttendedTarget: singleDayTarget.target_daily_attended,
      dailyPreordersTarget: singleDayTarget.target_daily_preorders,
      scaledCallsTarget: singleDayTarget.target_daily_calls,
      scaledTrainingTarget: singleDayTarget.target_daily_training_fixed,
      scaledAttendedTarget: singleDayTarget.target_daily_attended,
      scaledPreordersTarget: singleDayTarget.target_daily_preorders,
      scaledTasksTarget: singleDayTarget.target_daily_tasks || 10,
      targetLeadConversionRate: singleDayTarget.target_lead_conversion_rate || 30,
      targetTrainingShowupRate: singleDayTarget.target_training_showup_rate || 65,
      targetPreorderConversionRate: singleDayTarget.target_preorder_conversion_rate || 25,
      activeSnapshot: singleDayTarget,
    };
  }

  // Iterate over each calendar day between sDate and eDate:
  let totalCalls = 0;
  let totalTraining = 0;
  let totalAttended = 0;
  let totalPreorders = 0;
  let totalTasks = 0;
  let workDayCount = 0;

  const cur = new Date(sDate);
  cur.setUTCHours(12, 0, 0, 0);

  const endUtc = new Date(eDate);
  endUtc.setUTCHours(12, 0, 0, 0);

  while (cur <= endUtc) {
    const curYMD = cur.toISOString().split("T")[0];
    const dayOfWeek = cur.getUTCDay(); // 0 = Sun, 6 = Sat

    // Check if Moroccan working day (Mon-Fri)
    const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (isWorkingDay) {
      workDayCount++;
      const dayTarget = getTargetForDate(curYMD, parsedHistory, fallback);
      totalCalls += dayTarget.target_daily_calls;
      totalTraining += dayTarget.target_daily_training_fixed;
      totalAttended += dayTarget.target_daily_attended;
      totalPreorders += dayTarget.target_daily_preorders;
      totalTasks += dayTarget.target_daily_tasks || 10;
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Fallback if no working days were counted (e.g. weekend selected)
  if (workDayCount === 0) {
    const fallbackTarget = getTargetForDate(endYMD, parsedHistory, fallback);
    totalCalls = fallbackTarget.target_daily_calls;
    totalTraining = fallbackTarget.target_daily_training_fixed;
    totalAttended = fallbackTarget.target_daily_attended;
    totalPreorders = fallbackTarget.target_daily_preorders;
    totalTasks = fallbackTarget.target_daily_tasks || 10;
    workDayCount = 1;
  }

  const latestTarget = getTargetForDate(endYMD, parsedHistory, fallback);

  return {
    workingDays: workDayCount,
    dailyCallsTarget: Math.round(totalCalls / workDayCount),
    dailyTrainingTarget: Math.round(totalTraining / workDayCount),
    dailyAttendedTarget: Math.round(totalAttended / workDayCount),
    dailyPreordersTarget: Math.round(totalPreorders / workDayCount),
    scaledCallsTarget: totalCalls,
    scaledTrainingTarget: totalTraining,
    scaledAttendedTarget: totalAttended,
    scaledPreordersTarget: totalPreorders,
    scaledTasksTarget: totalTasks,
    targetLeadConversionRate: latestTarget.target_lead_conversion_rate || 30,
    targetTrainingShowupRate: latestTarget.target_training_showup_rate || 65,
    targetPreorderConversionRate: latestTarget.target_preorder_conversion_rate || 25,
    activeSnapshot: latestTarget,
  };
}
