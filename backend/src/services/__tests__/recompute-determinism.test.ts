import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDiningChallenge,
  computeSavingsChallenge,
} from "../challenge-engine.js";
import { computeNoSpendDayStreak } from "../habit-streak-engine.js";

test("habit streak math is deterministic", () => {
  const spendDates = new Set(["2026-06-03"]);
  const a = computeNoSpendDayStreak(spendDates, "2026-06-05");
  const b = computeNoSpendDayStreak(spendDates, "2026-06-05");
  assert.deepEqual(a, b);
});

test("challenge progress is deterministic for fixed inputs", () => {
  const dining = computeDiningChallenge({
    baselineMonthly: 800,
    monthSpend: 600,
    daysRemaining: 10,
  });
  const again = computeDiningChallenge({
    baselineMonthly: 800,
    monthSpend: 600,
    daysRemaining: 10,
  });
  assert.deepEqual(dining, again);

  const savings = computeSavingsChallenge({
    monthIncome: 8000,
    monthSpending: 5000,
    daysRemaining: 12,
  });
  assert.ok(savings);
  assert.equal(
    computeSavingsChallenge({
      monthIncome: 8000,
      monthSpending: 5000,
      daysRemaining: 12,
    })?.progressPercent,
    savings.progressPercent,
  );
});
