import assert from "node:assert/strict";
import test from "node:test";

import {
  computeBenchmarkDelta,
  computeBenchmarkReturn,
  computeMaxDrawdown,
  computeTwr,
} from "../investment/twr.js";

test("TWR: geometric link over sub-periods", () => {
  const result = computeTwr([
    { date: "2024-01-01", value: 10_000 },
    { date: "2024-02-01", value: 10_500 },
    { date: "2024-03-01", value: 11_025 },
  ]);
  assert.ok(result);
  assert.ok(Math.abs(result.twr - 0.1025) < 0.001);
  assert.equal(result.subPeriodCount, 2);
});

test("TWR: adjusts for external cash flows", () => {
  const result = computeTwr(
    [
      { date: "2024-01-01", value: 10_000 },
      { date: "2024-02-01", value: 15_500 },
    ],
    [{ date: "2024-02-01", amount: 5000 }],
  );
  assert.ok(result);
  assert.ok(Math.abs(result.twr - 0.05) < 0.001);
});

test("max drawdown: peak-to-trough fraction", () => {
  const dd = computeMaxDrawdown([
    { date: "2024-01-01", value: 10_000 },
    { date: "2024-02-01", value: 12_000 },
    { date: "2024-03-01", value: 9_000 },
    { date: "2024-04-01", value: 10_500 },
  ]);
  assert.ok(dd);
  assert.ok(Math.abs(dd.maxDrawdown - -0.25) < 0.001);
  assert.equal(dd.peakDate, "2024-02-01");
  assert.equal(dd.troughDate, "2024-03-01");
});

test("benchmark return from price series", () => {
  const ret = computeBenchmarkReturn(
    [
      { date: "2024-01-01", close: 400 },
      { date: "2024-06-01", close: 420 },
      { date: "2024-12-31", close: 440 },
    ],
    "2024-01-01",
    "2024-12-31",
  );
  assert.ok(ret != null);
  assert.ok(Math.abs(ret - 0.1) < 0.001);
});

test("benchmark delta = portfolio TWR - benchmark", () => {
  assert.ok(Math.abs(computeBenchmarkDelta(0.12, 0.08) - 0.04) < 1e-9);
});
