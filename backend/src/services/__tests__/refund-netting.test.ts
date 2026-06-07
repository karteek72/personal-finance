import assert from "node:assert/strict";
import test from "node:test";

import {
  isLikelyRefundCredit,
  netRefundCredits,
} from "../refund-netting.js";

test("isLikelyRefundCredit treats non-income category credits as refunds", () => {
  assert.equal(
    isLikelyRefundCredit({
      transactionType: "income",
      category: "Shopping & Retail",
      name: "AMAZON MARKETPLACE",
      merchantName: "Amazon",
    }),
    true,
  );
  assert.equal(
    isLikelyRefundCredit({
      transactionType: "income",
      category: "Income",
      name: "Payroll",
      merchantName: "Employer",
    }),
    false,
  );
});

test("netRefundCredits pairs merchant-matched credit to prior debit", () => {
  const debits = [
    {
      id: "d1",
      date: "2026-05-01",
      amount: 89.99,
      merchantKey: "amazon",
      category: "Shopping & Retail",
    },
  ];
  const credits = [
    {
      id: "c1",
      date: "2026-05-20",
      amount: 89.99,
      merchantKey: "amazon",
      category: "Shopping & Retail",
    },
  ];
  const result = netRefundCredits(debits, credits);
  assert.equal(result.nettedPairs.length, 1);
  assert.equal(result.nettedTotal, 89.99);
  assert.equal(result.unmatchedCreditTotal, 0);
});

test("netRefundCredits leaves unmatched credits as income/rebate", () => {
  const result = netRefundCredits(
    [],
    [
      {
        id: "c1",
        date: "2026-05-20",
        amount: 25,
        merchantKey: "rebate",
        category: "Shopping & Retail",
      },
    ],
  );
  assert.equal(result.nettedPairs.length, 0);
  assert.equal(result.unmatchedCreditTotal, 25);
});
