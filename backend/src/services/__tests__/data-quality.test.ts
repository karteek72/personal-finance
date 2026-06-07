import assert from "node:assert/strict";
import test from "node:test";

import {
  compositeDataQualityConfidence,
  applyDataQualityConfidence,
} from "../data-quality.js";
import { buildMetricEnvelope } from "../metrics/types.js";

test("compositeDataQualityConfidence blends signals conservatively", () => {
  const lowTransfer = compositeDataQualityConfidence({
    categorization: 1,
    syncFreshness: 1,
    transferPairs: 0,
    reconciliation: 0.75,
    pending: 1,
    costBasis: 1,
  });
  const highTransfer = compositeDataQualityConfidence({
    categorization: 1,
    syncFreshness: 1,
    transferPairs: 1,
    reconciliation: 0.75,
    pending: 1,
    costBasis: 1,
  });
  assert.ok(lowTransfer > 0.7);
  assert.ok(lowTransfer < 1);
  assert.ok(highTransfer > lowTransfer);
});

test("applyDataQualityConfidence scales envelope confidence", () => {
  const envelope = buildMetricEnvelope({
    value: 0.2,
    unit: "percent",
    asOf: "2026-06-01",
    class: "diagnostic",
    basis: "factual",
    confidence: 0.9,
  });
  const scaled = applyDataQualityConfidence(envelope, 0.5);
  assert.equal(scaled.confidence, 0.45);
});
