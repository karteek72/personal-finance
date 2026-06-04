import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeImportBatchSummary,
  fileCanReplace,
  fileCanRetryParse,
} from "../import-batch-summary.js";

test("computeImportBatchSummary counts ready, failed, and transaction totals", () => {
  const summary = computeImportBatchSummary([
    {
      status: "preview_ready",
      parsedPreview: {
        statements: [
          {
            bankingTransactions: [{ date: "2024-01-01" }],
            investmentTransactions: [],
          },
        ],
      },
    },
    { status: "failed", parsedPreview: null },
    { status: "parsed", parsedPreview: null },
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.ready, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.imported, 1);
  assert.equal(summary.bankingTransactions, 1);
  assert.equal(summary.investmentTransactions, 0);
});

test("fileCanRetryParse allows retry when failed with encrypted blob", () => {
  assert.equal(fileCanRetryParse("failed", "encrypted"), true);
  assert.equal(fileCanRetryParse("failed", ""), false);
  assert.equal(fileCanRetryParse("preview_ready", "encrypted"), false);
});

test("fileCanReplace allows replace only for failed files", () => {
  assert.equal(fileCanReplace("failed"), true);
  assert.equal(fileCanReplace("preview_ready"), false);
});
