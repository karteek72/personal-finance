import assert from "node:assert/strict";
import test from "node:test";

import {
  burnRateMetric,
  computeBurnRate,
  computeEmergencyMonths,
  computeFreeCashFlow,
  computeSavingsRate,
  emergencyMonthsMetric,
  freeCashFlowMetric,
  metricNumericValue,
  savingsRateMetric,
  type MetricEnvelope,
} from "../metrics/index.js";
import { buildWellnessDimensions, compositeCashFlowScore } from "../wellness-scoring.js";

/**
 * Golden dataset — hand-computed expected values for the metric layer.
 * income 6000, total expense 4500, essential 3000, liquid 12000,
 * trailing-3mo essential total 8400 → burn 2800/mo, debt_min 150, recurring 200.
 */
const GOLDEN = {
  income: 6000,
  expense: 4500,
  essentialOutflow: 3000,
  liquidReserves: 12_000,
  trailing3MoEssentialTotal: 8400,
  trailingMonths: 3,
  debtMin: 150,
  committedRecurring: 200,
  asOf: "2026-06-01",
} as const;

const EXPECTED = {
  savingsRate: 0.25,
  burnRate: 2800,
  freeCashFlow: 2650,
  emergencyMonths: 4.29,
} as const;

function assertEnvelope(
  envelope: MetricEnvelope,
  expectedValue: number,
  unit: MetricEnvelope["unit"],
  tolerance = 0.01,
): void {
  assert.equal(envelope.unit, unit);
  const numeric = metricNumericValue(envelope);
  assert.ok(
    Math.abs(numeric - expectedValue) <= tolerance,
    `expected ${expectedValue}, got ${numeric} (envelope.value=${envelope.value})`,
  );
}

test("golden dataset: computeSavingsRate", () => {
  assert.equal(
    computeSavingsRate({ income: GOLDEN.income, expense: GOLDEN.expense }),
    EXPECTED.savingsRate,
  );
});

test("golden dataset: savingsRateMetric envelope", () => {
  const envelope = savingsRateMetric({
    income: GOLDEN.income,
    expense: GOLDEN.expense,
    asOf: GOLDEN.asOf,
  });
  assert.equal(envelope.unit, "percent");
  assert.equal(envelope.basis, "factual");
  assertEnvelope(envelope, EXPECTED.savingsRate, "percent", 0.0001);
});

test("golden dataset: computeBurnRate", () => {
  assert.equal(
    computeBurnRate({
      essentialOutflowTotal: GOLDEN.trailing3MoEssentialTotal,
      months: GOLDEN.trailingMonths,
    }),
    EXPECTED.burnRate,
  );
});

test("golden dataset: burnRateMetric envelope", () => {
  const envelope = burnRateMetric({
    essentialOutflowTotal: GOLDEN.trailing3MoEssentialTotal,
    months: GOLDEN.trailingMonths,
    asOf: GOLDEN.asOf,
  });
  assertEnvelope(envelope, EXPECTED.burnRate, "USD");
});

test("golden dataset: computeFreeCashFlow", () => {
  assert.equal(
    computeFreeCashFlow({
      income: GOLDEN.income,
      essentialOutflow: GOLDEN.essentialOutflow,
      debtMin: GOLDEN.debtMin,
      committedRecurring: GOLDEN.committedRecurring,
    }),
    EXPECTED.freeCashFlow,
  );
});

test("golden dataset: freeCashFlowMetric envelope", () => {
  const envelope = freeCashFlowMetric({
    income: GOLDEN.income,
    essentialOutflow: GOLDEN.essentialOutflow,
    debtMin: GOLDEN.debtMin,
    committedRecurring: GOLDEN.committedRecurring,
    asOf: GOLDEN.asOf,
  });
  assertEnvelope(envelope, EXPECTED.freeCashFlow, "USD");
});

test("golden dataset: computeEmergencyMonths", () => {
  const burn = computeBurnRate({
    essentialOutflowTotal: GOLDEN.trailing3MoEssentialTotal,
    months: GOLDEN.trailingMonths,
  });
  assert.equal(
    computeEmergencyMonths({
      liquidReserves: GOLDEN.liquidReserves,
      essentialBurnRate: burn,
    }),
    EXPECTED.emergencyMonths,
  );
});

test("golden dataset: emergencyMonthsMetric envelope", () => {
  const envelope = emergencyMonthsMetric({
    liquidReserves: GOLDEN.liquidReserves,
    essentialBurnRate: EXPECTED.burnRate,
    asOf: GOLDEN.asOf,
  });
  assertEnvelope(envelope, EXPECTED.emergencyMonths, "months");
});

test("wellness history uses cash-flow-only score without balance snapshots", () => {
  const dims = buildWellnessDimensions({
    savingsRate: EXPECTED.savingsRate,
    freeCashFlow: EXPECTED.freeCashFlow,
    income: GOLDEN.income,
    emergencyMonths: 0,
    utilization: null,
    netInvestRate: null,
    spendingVolatility: null,
    discretionaryShare: null,
    goals: [],
  });
  const cashFlowScore = compositeCashFlowScore(dims);
  assert.ok(cashFlowScore > 0);
  assert.ok(cashFlowScore <= 100);
});

test("savings rate is 0–1 fraction with zero income caveat", () => {
  const envelope = savingsRateMetric({
    income: 0,
    expense: 500,
    asOf: GOLDEN.asOf,
  });
  assert.equal(metricNumericValue(envelope), 0);
  assert.ok(envelope.caveats?.some((c) => c.includes("No income")));
});
