import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResilienceComposite,
  computeDebtBurdenScore,
  computeIncomeStabilityScore,
  computeLiquidityScore,
  resilienceBand,
} from "../resilience-scoring.js";

test("resilienceBand maps score ranges to interpretation bands", () => {
  assert.equal(resilienceBand(30), "critical");
  assert.equal(resilienceBand(50), "vulnerable");
  assert.equal(resilienceBand(65), "stable");
  assert.equal(resilienceBand(80), "resilient");
  assert.equal(resilienceBand(95), "fortified");
});

test("computeLiquidityScore targets six emergency months", () => {
  assert.equal(computeLiquidityScore(3), 50);
  assert.equal(computeLiquidityScore(6), 100);
  assert.equal(computeLiquidityScore(9), 100);
});

test("computeIncomeStabilityScore caps single-source income at 70", () => {
  const stable = computeIncomeStabilityScore(
    [5000, 5100, 4950, 5050, 5000, 5025],
    2,
  );
  const single = computeIncomeStabilityScore(
    [5000, 5100, 4950, 5050, 5000, 5025],
    1,
  );
  assert.ok(stable > 70);
  assert.equal(single, 70);
});

test("computeDebtBurdenScore penalizes high DTI", () => {
  assert.equal(computeDebtBurdenScore(0.18), 50);
  assert.equal(computeDebtBurdenScore(0.36), 0);
});

test("buildResilienceComposite applies architecture weights", () => {
  const composite = buildResilienceComposite({
    emergencyMonths: 6,
    monthlyIncomes: [6000, 6100, 5900, 6050, 6000, 5950],
    incomeSourceCount: +2,
    discretionaryOutflow: 1200,
    totalOutflow: 4000,
    dti: 0.15,
    liquidInvest: 5000,
    totalInvest: 20000,
    asOf: "2026-06-01",
  });
  assert.equal(composite.subScores.length, 5);
  assert.ok(composite.score >= 60);
  assert.equal(composite.band, resilienceBand(composite.score));
  for (const sub of composite.subScores) {
    assert.ok(sub.action.length > 0);
    assert.ok(sub.score >= 0 && sub.score <= 100);
  }
});
