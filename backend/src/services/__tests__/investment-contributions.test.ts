import assert from "node:assert/strict";
import test from "node:test";

import { cashImpactForInvestmentTx } from "../investment-analytics.js";
import { mapSnaptradeActivityType } from "../investment-txn-classify.js";

test("mapSnaptradeActivityType excludes transfers and withdrawals from buys", () => {
  assert.equal(mapSnaptradeActivityType("BUY"), "buy");
  assert.equal(mapSnaptradeActivityType("TRANSFER"), "fee");
  assert.equal(mapSnaptradeActivityType("WITHDRAWAL"), "fee");
  assert.equal(mapSnaptradeActivityType("UNKNOWN"), "fee");
});

test("cashImpactForInvestmentTx uses premium for options not contract notional", () => {
  const impact = cashImpactForInvestmentTx({
    type: "buy",
    date: "2024-01-01",
    amount: "50000.00",
    quantity: "10",
    price: "5.00",
    ticker: "HOOD  270115C00100000",
    assetType: "option",
    securityId: "x",
    name: "Buy HOOD call",
  });
  assert.equal(impact, 5000);
});

test("cashImpactForInvestmentTx ignores transfer-like activity names", () => {
  const impact = cashImpactForInvestmentTx({
    type: "contribution",
    date: "2024-01-01",
    amount: "250000.00",
    quantity: null,
    price: null,
    ticker: null,
    assetType: null,
    securityId: null,
    name: "ACAT Transfer In",
  });
  assert.equal(impact, 0);
});

test("cashImpactForInvestmentTx skips buy rows missing fill details with large notional", () => {
  const impact = cashImpactForInvestmentTx({
    type: "buy",
    date: "2024-01-01",
    amount: "50000.00",
    quantity: null,
    price: null,
    ticker: "HOOD  270115C00100000",
    assetType: "option",
    securityId: "x",
    name: "Activity",
  });
  assert.equal(impact, 0);
});
