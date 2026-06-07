import assert from "node:assert/strict";
import test from "node:test";

import {
  computeUnrealizedPl,
  replayFifoTaxLots,
  summarizeRealizedPl,
  type TaxLotInput,
  type TaxLotTxnInput,
} from "../investment/fifo-tax-lots.js";

const BUY_10_100: TaxLotTxnInput = {
  id: "buy-1",
  accountId: "acct-1",
  securityId: "sec-aapl",
  date: "2024-01-01",
  type: "buy",
  quantity: 10,
  price: 100,
  amount: 1000,
};

const BUY_10_120: TaxLotTxnInput = {
  id: "buy-2",
  accountId: "acct-1",
  securityId: "sec-aapl",
  date: "2024-06-01",
  type: "buy",
  quantity: 10,
  price: 120,
  amount: 1200,
};

const SELL_15_130: TaxLotTxnInput = {
  id: "sell-1",
  accountId: "acct-1",
  securityId: "sec-aapl",
  date: "2024-12-01",
  type: "sell",
  quantity: 15,
  price: 130,
  amount: 1950,
};

test("FIFO: sell consumes oldest lots first", () => {
  const { openLots, realizedSales } = replayFifoTaxLots([
    BUY_10_100,
    BUY_10_120,
    SELL_15_130,
  ]);

  assert.equal(realizedSales.length, 1);
  const sale = realizedSales[0];
  assert.ok(sale);
  assert.equal(sale.proceeds, 1950);
  assert.equal(sale.costBasis, 1600);
  assert.equal(sale.gainLoss, 350);
  assert.equal(sale.shortTermGain, 350);
  assert.equal(sale.longTermGain, 0);
  assert.equal(sale.matches.length, 2);
  assert.equal(sale.matches[0]?.quantity, 10);
  assert.equal(sale.matches[1]?.quantity, 5);

  assert.equal(openLots.length, 1);
  assert.equal(openLots[0]?.quantityRemaining, 5);
  assert.equal(openLots[0]?.costPerUnit, 120);
});

test("FIFO: long-term gain when lot held >= 366 days", () => {
  const buy: TaxLotTxnInput = {
    ...BUY_10_100,
    date: "2023-01-01",
  };
  const sell: TaxLotTxnInput = {
    ...SELL_15_130,
    quantity: 10,
    amount: 1300,
    date: "2024-06-01",
  };
  const { realizedSales } = replayFifoTaxLots([buy, sell]);
  const sale = realizedSales[0];
  assert.ok(sale);
  assert.equal(sale.longTermGain, 300);
  assert.equal(sale.shortTermGain, 0);
});

test("FIFO: wash sale flagged on loss + repurchase within 30 days", () => {
  const sellLoss: TaxLotTxnInput = {
    id: "sell-loss",
    accountId: "acct-1",
    securityId: "sec-aapl",
    date: "2024-02-01",
    type: "sell",
    quantity: 10,
    price: 90,
    amount: 900,
  };
  const repurchase: TaxLotTxnInput = {
    id: "buy-3",
    accountId: "acct-1",
    securityId: "sec-aapl",
    date: "2024-02-15",
    type: "buy",
    quantity: 10,
    price: 95,
    amount: 950,
  };

  const { realizedSales } = replayFifoTaxLots([
    BUY_10_100,
    sellLoss,
    repurchase,
  ]);
  const sale = realizedSales[0];
  assert.ok(sale);
  assert.ok(sale.gainLoss < 0);
  assert.equal(sale.washSale, true);
});

test("summarizeRealizedPl filters by date range", () => {
  const { realizedSales } = replayFifoTaxLots([
    BUY_10_100,
    BUY_10_120,
    SELL_15_130,
  ]);
  const summary = summarizeRealizedPl(
    realizedSales,
    "2024-06-01",
    "2024-12-31",
  );
  assert.equal(summary.totalGainLoss, 350);
  assert.equal(
    summarizeRealizedPl(realizedSales, "2025-01-01", "2025-12-31").totalGainLoss,
    0,
  );
});

test("computeUnrealizedPl uses current prices", () => {
  const lots: TaxLotInput[] = [
    {
      id: "lot-1",
      accountId: "acct-1",
      securityId: "sec-aapl",
      openDate: "2024-01-01",
      quantityOpen: 5,
      quantityRemaining: 5,
      costPerUnit: 100,
    },
  ];
  const prices = new Map([["sec-aapl", 150]]);
  const result = computeUnrealizedPl(lots, prices);
  assert.equal(result.totalCostBasis, 500);
  assert.equal(result.totalMarketValue, 750);
  assert.equal(result.totalUnrealizedGain, 250);
});
