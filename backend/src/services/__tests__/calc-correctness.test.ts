import assert from "node:assert/strict";
import test from "node:test";

import { computeSavingsRate } from "../metrics/savings-rate.js";
import {
  averageSpendPerWeekdayOccurrence,
  buildWellnessDimensions,
  compositeCashFlowScore,
  compositeScore,
  countNoSpendDays,
  scoreFromRatio,
} from "../wellness-scoring.js";

test("computeSavingsRate returns 0–1 fraction", () => {
  assert.equal(computeSavingsRate({ income: 5000, expense: 4000 }), 0.2);
  assert.equal(computeSavingsRate({ income: 0, expense: 100 }), 0);
  assert.equal(computeSavingsRate({ income: 1000, expense: 1200 }), -0.2);
});

test("scoreFromRatio: lower-is-better decreases as actual rises", () => {
  const lowUtil = scoreFromRatio(10, 30, false);
  const highUtil = scoreFromRatio(90, 30, false);
  assert.ok(lowUtil > highUtil);
  assert.equal(lowUtil, 100);
  assert.equal(highUtil, 33);

  const lowExpense = scoreFromRatio(50, 72, false);
  const highExpense = scoreFromRatio(110, 72, false);
  assert.ok(lowExpense > highExpense);
  assert.equal(lowExpense, 100);
  assert.equal(highExpense, 65);
});

test("scoreFromRatio: higher-is-better increases as actual rises", () => {
  assert.equal(scoreFromRatio(0.25, 0.2, true), 100);
  assert.equal(scoreFromRatio(0.1, 0.2, true), 50);
});

test("buildWellnessDimensions omits debt when utilization unknown", () => {
  const dims = buildWellnessDimensions({
    savingsRate: 0.2,
    freeCashFlow: 500,
    income: 5000,
    emergencyMonths: 4,
    utilization: null,
    netInvestRate: 0.05,
    spendingVolatility: 0.4,
    discretionaryShare: 0.3,
    goals: [],
  });
  assert.equal(
    dims.find((d) => d.name === "Debt Health"),
    undefined,
  );
  assert.equal(
    dims.find((d) => d.name === "Inflation Beat"),
    undefined,
  );
  assert.equal(
    dims.find((d) => d.name === "Investment Growth"),
    undefined,
  );
});

test("buildWellnessDimensions includes debt when utilization known", () => {
  const dims = buildWellnessDimensions({
    savingsRate: 0.2,
    freeCashFlow: 500,
    income: 5000,
    emergencyMonths: 4,
    utilization: 10,
    netInvestRate: 0.05,
    spendingVolatility: 0.4,
    discretionaryShare: 0.3,
    goals: [],
  });
  const debt = dims.find((d) => d.name === "Debt Health");
  assert.ok(debt);
  assert.equal(debt.score, 100);
});

test("compositeScore re-normalizes when debt omitted", () => {
  const withoutDebt = buildWellnessDimensions({
    savingsRate: 0.2,
    freeCashFlow: 800,
    income: 5000,
    emergencyMonths: 6,
    utilization: null,
    netInvestRate: 0.1,
    spendingVolatility: 0.2,
    discretionaryShare: 0.2,
    goals: [
      {
        target: 1000,
        current: 500,
        deadline: "2027-01-01",
        createdAt: new Date("2026-01-01T12:00:00Z"),
      },
    ],
  });
  const withDebt = buildWellnessDimensions({
    savingsRate: 0.2,
    freeCashFlow: 800,
    income: 5000,
    emergencyMonths: 6,
    utilization: 10,
    netInvestRate: 0.1,
    spendingVolatility: 0.2,
    discretionaryShare: 0.2,
    goals: [
      {
        target: 1000,
        current: 500,
        deadline: "2027-01-01",
        createdAt: new Date("2026-01-01T12:00:00Z"),
      },
    ],
  });
  assert.ok(compositeScore(withoutDebt) > 0);
  assert.ok(compositeScore(withDebt) > 0);
  assert.equal(
    withoutDebt.reduce((s, d) => s + d.weight, 0),
    84,
  );
  assert.equal(withDebt.reduce((s, d) => s + d.weight, 0), 100);
});

test("compositeCashFlowScore uses savings and free cash flow dims", () => {
  const dims = buildWellnessDimensions({
    savingsRate: 0.2,
    freeCashFlow: 500,
    income: 5000,
    emergencyMonths: 0,
    utilization: null,
    netInvestRate: null,
    spendingVolatility: null,
    discretionaryShare: null,
    goals: [],
  });
  assert.ok(compositeCashFlowScore(dims) > 0);
});

test("averageSpendPerWeekdayOccurrence divides by distinct dates", () => {
  assert.equal(averageSpendPerWeekdayOccurrence(300, 3), 100);
  assert.equal(averageSpendPerWeekdayOccurrence(500, 0), 0);
});

test("countNoSpendDays caps at today for current year", () => {
  const spendDates = new Set(["2026-01-05", "2026-01-10"]);
  const count = countNoSpendDays({
    year: 2026,
    spendDates,
    today: "2026-01-15",
  });
  assert.equal(count, 13);
});

test("countNoSpendDays uses full year for past years", () => {
  const spendDates = new Set<string>();
  const count = countNoSpendDays({
    year: 2024,
    spendDates,
    today: "2026-06-07",
  });
  assert.equal(count, 366);
});

test("countNoSpendDays subtracts days with spend", () => {
  const spendDates = new Set(["2024-01-01"]);
  const count = countNoSpendDays({
    year: 2024,
    spendDates,
    today: "2026-06-07",
  });
  assert.equal(count, 365);
});
