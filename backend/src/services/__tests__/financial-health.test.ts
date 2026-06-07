import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWellnessDimensions,
  compositeConfidence,
  compositeScore,
  goalOnTrackRatio,
  goalPaceScore,
} from "../wellness-scoring.js";
import {
  computeFireProjection,
  computeIncomeStability,
  computeIncomeSummary,
  compoundFutureValue,
} from "../computed-fields.js";

test("Financial Health uses architecture weights (no fabricated dims)", () => {
  const dims = buildWellnessDimensions({
    savingsRate: 0.25,
    freeCashFlow: 900,
    income: 6000,
    emergencyMonths: 4,
    utilization: 20,
    netInvestRate: 0.1,
    spendingVolatility: 0.3,
    discretionaryShare: 0.25,
    goals: [],
    dataQualityConfidence: 0.9,
  });

  assert.equal(
    dims.find((d) => d.name === "Inflation Beat"),
    undefined,
  );
  assert.equal(
    dims.find((d) => d.name === "Income-to-Expense"),
    undefined,
  );

  const savings = dims.find((d) => d.name === "Savings Rate");
  assert.ok(savings);
  assert.equal(savings.weight, 22);
  assert.equal(savings.score, 100);

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  assert.equal(totalWeight, 100);
  assert.ok(compositeScore(dims) > 0);
  assert.ok(compositeConfidence(dims) > 0);
});

test("goal pace is deadline-aware", () => {
  const createdAt = new Date("2025-01-01T12:00:00Z");
  const onTrack = goalOnTrackRatio({
    target: 1000,
    current: 500,
    deadline: "2025-07-01",
    createdAt,
    asOf: new Date("2025-04-01T12:00:00Z"),
  });
  assert.ok(onTrack != null && onTrack >= 0.9);

  const behind = goalOnTrackRatio({
    target: 1000,
    current: 100,
    deadline: "2025-07-01",
    createdAt,
    asOf: new Date("2025-04-01T12:00:00Z"),
  });
  assert.ok(behind != null && behind < 0.5);
});

test("goalPaceScore counts deadline-aware goals", () => {
  const stats = goalPaceScore([
    {
      target: 1000,
      current: 500,
      deadline: "2026-12-31",
      createdAt: new Date("2026-01-01T12:00:00Z"),
    },
  ]);
  assert.equal(stats.count, 1);
});

test("computeIncomeStability uses 1 − CoV clamped 0–100", () => {
  assert.equal(computeIncomeStability([5000, 5000, 5000]), 100);
  assert.ok(computeIncomeStability([1000, 9000]) < 50);
});

test("computeFireProjection returns server-side curve", () => {
  const projection = computeFireProjection({
    currentAge: 35,
    currentNetWorth: 100_000,
    monthlySpend: 4000,
    monthlyInvest: 2000,
    withdrawalRate: 4,
    realReturn: 6,
  });
  assert.ok(Number.parseFloat(projection.fireNumber) > 0);
  assert.ok(projection.yearsToFire > 0);
  assert.ok(projection.curve.length > 0);
});

test("computeIncomeSummary pre-computes chart ticks", () => {
  const summary = computeIncomeSummary({
    months: ["01", "02"],
    primary: [5000, 5200],
    side: [200, 300],
  });
  assert.ok(summary.incomeStability >= 95);
  assert.ok(summary.chartYTicks.length === 3);
});

test("compoundFutureValue matches time-machine helper", () => {
  assert.equal(compoundFutureValue(10_000, 0.07, 20), 38_696.84);
});
