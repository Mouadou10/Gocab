import { test, describe } from "node:test";
import assert from "node:assert";
import {
  getTargetForDate,
  getTargetsForRange,
  DEFAULT_TARGET_HISTORY,
  TargetSnapshot,
} from "../src/lib/target-history";

describe("Date-Effective Target History Engine", () => {
  const history: TargetSnapshot[] = [
    {
      effective_date: "2026-10-01",
      target_daily_calls: 50,
      target_daily_training_fixed: 15,
      target_daily_attended: 10,
      target_daily_preorders: 4,
    },
    {
      effective_date: "2026-10-21",
      target_daily_calls: 80,
      target_daily_training_fixed: 24,
      target_daily_attended: 16,
      target_daily_preorders: 6,
    },
    {
      effective_date: "2026-10-22",
      target_daily_calls: 133,
      target_daily_training_fixed: 40,
      target_daily_attended: 26,
      target_daily_preorders: 10,
    },
  ];

  test("should resolve exact operational target for yesterday (2026-10-21)", () => {
    const yesterdayTarget = getTargetForDate("2026-10-21", history);
    assert.strictEqual(yesterdayTarget.target_daily_calls, 80);
    assert.strictEqual(yesterdayTarget.target_daily_training_fixed, 24);
    assert.strictEqual(yesterdayTarget.target_daily_attended, 16);
    assert.strictEqual(yesterdayTarget.target_daily_preorders, 6);
  });

  test("should resolve today's updated target (2026-10-22)", () => {
    const todayTarget = getTargetForDate("2026-10-22", history);
    assert.strictEqual(todayTarget.target_daily_calls, 133);
    assert.strictEqual(todayTarget.target_daily_training_fixed, 40);
    assert.strictEqual(todayTarget.target_daily_attended, 26);
    assert.strictEqual(todayTarget.target_daily_preorders, 10);
  });

  test("should resolve earlier historical target (e.g. 2026-10-15)", () => {
    const midMonthTarget = getTargetForDate("2026-10-15", history);
    assert.strictEqual(midMonthTarget.target_daily_calls, 50);
    assert.strictEqual(midMonthTarget.target_daily_training_fixed, 15);
  });

  test("should aggregate multi-day range by summing daily active targets (2026-10-21 to 2026-10-22)", () => {
    // Both 2026-10-21 (Wed) and 2026-10-22 (Thu) are working days
    const rangeResult = getTargetsForRange("2026-10-21", "2026-10-22", history);
    assert.strictEqual(rangeResult.workingDays, 2);
    // Sum of Day 1 (80 calls) + Day 2 (133 calls) = 213 calls
    assert.strictEqual(rangeResult.scaledCallsTarget, 213);
    // Sum of Day 1 (24 fixed) + Day 2 (40 fixed) = 64 fixed
    assert.strictEqual(rangeResult.scaledTrainingTarget, 64);
    // Sum of Day 1 (16 attended) + Day 2 (26 attended) = 42 attended
    assert.strictEqual(rangeResult.scaledAttendedTarget, 42);
    // Sum of Day 1 (6 preorders) + Day 2 (10 preorders) = 16 preorders
    assert.strictEqual(rangeResult.scaledPreordersTarget, 16);
  });

  test("single-day range should return exact single-day target", () => {
    const singleResult = getTargetsForRange("2026-10-21", "2026-10-21", history);
    assert.strictEqual(singleResult.workingDays, 1);
    assert.strictEqual(singleResult.scaledCallsTarget, 80);
    assert.strictEqual(singleResult.scaledTrainingTarget, 24);
  });
});
