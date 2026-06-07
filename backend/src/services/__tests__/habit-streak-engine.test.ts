import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHabitStreakRows,
  computeDaysSinceDiningStreak,
  computeNoSpendDayStreak,
  computePositiveSavingsMonthStreak,
} from "../habit-streak-engine.js";

test("computeNoSpendDayStreak counts trailing zero-spend days", () => {
  const expenseDates = new Set(["2026-06-01", "2026-06-03"]);
  const result = computeNoSpendDayStreak(expenseDates, "2026-06-05");
  assert.equal(result.currentDays, 2);
  assert.ok(result.maxDays >= 2);
});

test("computePositiveSavingsMonthStreak counts trailing positive months", () => {
  const monthly = [
    { month: "2026-03", income: 5000, spending: 4000 },
    { month: "2026-04", income: 5000, spending: 5200 },
    { month: "2026-05", income: 5200, spending: 4800 },
    { month: "2026-06", income: 5300, spending: 4700 },
  ];
  const result = computePositiveSavingsMonthStreak(monthly);
  assert.equal(result.currentDays, 2);
  assert.equal(result.maxDays, 2);
});

test("computeDaysSinceDiningStreak measures days since last dining spend", () => {
  const result = computeDaysSinceDiningStreak(
    ["2026-06-01", "2026-06-03"],
    "2026-06-07",
  );
  assert.equal(result.currentDays, 4);
});

test("buildHabitStreakRows returns three labeled streaks", () => {
  const rows = buildHabitStreakRows({
    expenseDates: new Set(["2026-06-01"]),
    monthly: [{ month: "2026-06", income: 1000, spending: 500 }],
    diningDates: ["2026-06-02"],
    todayKey: "2026-06-05",
  });
  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.label, "No-spend day streak");
});
