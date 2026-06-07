import assert from "node:assert/strict";
import test from "node:test";

import { amountsMatch, datesMatch } from "../transfer-pairing.js";
import {
  computeNetInvestmentRate,
  netInvestmentRateMetric,
} from "../metrics/net-investment-rate.js";
import {
  computeTrueSavingsRate,
  trueSavingsRateMetric,
} from "../metrics/true-savings-rate.js";

test("amountsMatch accepts $1 absolute or 1% relative tolerance", () => {
  assert.equal(amountsMatch(100, 100.5), true);
  assert.equal(amountsMatch(100, 101), true);
  assert.equal(amountsMatch(100, 102), false);
});

test("datesMatch allows up to 4-day gap", () => {
  assert.equal(datesMatch("2026-06-01", "2026-06-04"), true);
  assert.equal(datesMatch("2026-06-01", "2026-06-06"), false);
});

test("computeNetInvestmentRate divides linked contributions by income", () => {
  assert.equal(
    computeNetInvestmentRate({ linkedContributions: 500, income: 5000 }),
    0.1,
  );
});

test("computeTrueSavingsRate nets refunds and linked investments", () => {
  const rate = computeTrueSavingsRate({
    income: 5000,
    grossExpense: 3500,
    nettedRefunds: 200,
    linkedInvestments: 500,
  });
  assert.equal(rate, 0.24);
});

test("netInvestmentRateMetric and trueSavingsRateMetric emit percent envelopes", () => {
  const invest = netInvestmentRateMetric({
    linkedContributions: 1000,
    income: 5000,
    asOf: "2026-06-01",
  });
  const savings = trueSavingsRateMetric({
    income: 5000,
    grossExpense: 3000,
    nettedRefunds: 0,
    linkedInvestments: 1000,
    asOf: "2026-06-01",
  });
  assert.equal(invest.unit, "percent");
  assert.equal(savings.unit, "percent");
  assert.equal(invest.value, "0.2");
  assert.equal(savings.value, "0.2");
});
