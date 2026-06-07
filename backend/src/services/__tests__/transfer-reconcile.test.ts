import assert from "node:assert/strict";
import test from "node:test";

import {
  looksLikeTransfer,
} from "../transfer-classification.js";
import {
  RECONCILE_CONFIDENCE_THRESHOLD,
  amountsMatch,
  meetsReconcileConfidence,
  reconciliationTargetForLink,
  shouldReconcileTransaction,
  selfTransferDatesMatch,
} from "../transfer-pairing.js";

test("reconciliationTargetForLink maps link kinds to internal categories", () => {
  const cc = reconciliationTargetForLink("cc_payment");
  assert.equal(cc.subCategory, "Credit Card Payments");
  assert.equal(cc.transactionType, "transfer");
  assert.equal(cc.isTransfer, true);

  const bank = reconciliationTargetForLink("bank_bank");
  assert.equal(bank.subCategory, "Bank Transfers");

  const brokerage = reconciliationTargetForLink("bank_brokerage");
  assert.equal(brokerage.subCategory, "Bank Transfers");
});

test("shouldReconcileTransaction is idempotent when already reconciled", () => {
  const target = reconciliationTargetForLink("bank_bank");
  assert.equal(
    shouldReconcileTransaction(
      {
        isTransfer: true,
        transactionType: "transfer",
        category: target.category,
        subCategory: target.subCategory,
      },
      target,
    ),
    false,
  );
  assert.equal(
    shouldReconcileTransaction(
      {
        isTransfer: false,
        transactionType: "expense",
        category: "Uncategorized",
        subCategory: null,
      },
      target,
    ),
    true,
  );
});

test("meetsReconcileConfidence respects threshold", () => {
  assert.equal(meetsReconcileConfidence(RECONCILE_CONFIDENCE_THRESHOLD), true);
  assert.equal(meetsReconcileConfidence(RECONCILE_CONFIDENCE_THRESHOLD - 0.01), false);
  assert.equal(meetsReconcileConfidence("0.85"), true);
});

test("selfTransferDatesMatch is tighter than full pairing tolerance", () => {
  assert.equal(selfTransferDatesMatch("2026-06-01", "2026-06-02"), true);
  assert.equal(selfTransferDatesMatch("2026-06-01", "2026-06-04"), false);
});

test("looksLikeTransfer matches conservative transfer name patterns", () => {
  assert.equal(
    looksLikeTransfer({ name: "Online Banking Transfer To Savings" }),
    true,
  );
  assert.equal(
    looksLikeTransfer({ name: "Whole Foods Market #1234" }),
    false,
  );
  assert.equal(
    looksLikeTransfer({
      name: "Payment",
      category: "Transfers (internal)",
    }),
    true,
  );
});

test("amountsMatch still gates self-transfer pairing", () => {
  assert.equal(amountsMatch(500, 500.5), true);
  assert.equal(amountsMatch(500, 510), false);
});
