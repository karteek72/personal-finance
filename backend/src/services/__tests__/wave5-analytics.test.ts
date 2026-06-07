import assert from "node:assert/strict";
import { test } from "node:test";
import {
  medianSpend,
  seasonalDeltaPercent,
  trailingMonths,
} from "../category-seasonal-delta.js";
import { nominalToReal } from "../personal-cpi.js";

test("seasonalDeltaPercent compares current to trailing median", () => {
  assert.equal(seasonalDeltaPercent(120, [80, 90, 100, 95, 85, 100]), 29.73);
  assert.equal(seasonalDeltaPercent(100, []), 0);
  assert.equal(seasonalDeltaPercent(100, [0, 0]), 0);
});

test("medianSpend returns middle value", () => {
  assert.equal(medianSpend([10, 20, 100]), 20);
  assert.equal(medianSpend([5, 15]), 10);
});

test("trailingMonths walks backward from reference month", () => {
  const months = trailingMonths("2026-06", 3);
  assert.deepEqual(months, ["2026-05", "2026-04", "2026-03"]);
});

test("nominalToReal deflates by personal CPI percent", () => {
  assert.equal(nominalToReal(103, 3), 100);
  assert.equal(nominalToReal(100, 0), 100);
});
