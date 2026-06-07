import assert from "node:assert/strict";
import test from "node:test";

import {
  computeRequiredMonthlySavings,
  computeFireProjection,
} from "../computed-fields.js";
import {
  emergencyFundTargetMonths,
  realReturnFromRiskTolerance,
} from "../investment-analytics.js";

test("realReturnFromRiskTolerance maps profile bands", () => {
  assert.equal(realReturnFromRiskTolerance("conservative"), 3.5);
  assert.equal(realReturnFromRiskTolerance("moderate"), 4.5);
  assert.equal(realReturnFromRiskTolerance("aggressive"), 6);
  assert.equal(realReturnFromRiskTolerance(null), 4.5);
});

test("emergencyFundTargetMonths scales with household size", () => {
  assert.equal(emergencyFundTargetMonths(1), 3);
  assert.equal(emergencyFundTargetMonths(3), 4);
  assert.equal(emergencyFundTargetMonths(10), 6);
});

test("computeFireProjection uses investable start balance", () => {
  const lean = computeFireProjection({
    currentAge: 42,
    currentNetWorth: 50_000,
    monthlySpend: 5000,
    monthlyInvest: 2000,
    withdrawalRate: 4,
    realReturn: 4.5,
  });
  const padded = computeFireProjection({
    currentAge: 42,
    currentNetWorth: 250_000,
    monthlySpend: 5000,
    monthlyInvest: 2000,
    withdrawalRate: 4,
    realReturn: 4.5,
  });
  assert.ok(padded.yearsToFire < lean.yearsToFire);
});

test("computeRequiredMonthlySavings reaches target within horizon", () => {
  const monthly = computeRequiredMonthlySavings({
    start: 100_000,
    target: 500_000,
    years: 10,
    annualReturn: 0.045,
  });
  assert.ok(monthly > 0);
});
