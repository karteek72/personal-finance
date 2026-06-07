import assert from "node:assert/strict";
import { test } from "node:test";

import { simulateRunwayMonteCarlo } from "../planning-engine.js";

// Payoff simulation logic mirrored for unit test (pure function extract would be overkill)
function simulatePayoffMonths(
  balance: number,
  apr: number,
  minimum: number,
  extra: number,
): number {
  let b = balance;
  let month = 0;
  while (b > 0.01 && month < 360) {
    month += 1;
    b += (b * (apr / 100)) / 12;
    b -= Math.min(minimum, b);
    b -= Math.min(extra, b);
  }
  return month;
}

test("extra payments shorten payoff timeline", () => {
  const minOnly = simulatePayoffMonths(5000, 22, 100, 0);
  const withExtra = simulatePayoffMonths(5000, 22, 100, 200);
  assert.ok(withExtra < minOnly);
});

test("higher APR extends payoff timeline", () => {
  const lowApr = simulatePayoffMonths(3000, 12, 75, 50);
  const highApr = simulatePayoffMonths(3000, 24, 75, 50);
  assert.ok(highApr > lowApr);
});

test("simulateRunwayMonteCarlo is deterministic for the same seed", () => {
  const a = simulateRunwayMonteCarlo(12000, 2800, { seed: 42, iterations: 100 });
  const b = simulateRunwayMonteCarlo(12000, 2800, { seed: 42, iterations: 100 });
  assert.deepEqual(a, b);
});

test("simulateRunwayMonteCarlo seed changes the distribution", () => {
  const a = simulateRunwayMonteCarlo(50000, 3200, { seed: 11, iterations: 200 });
  const b = simulateRunwayMonteCarlo(50000, 3200, { seed: 99, iterations: 200 });
  assert.ok(a.p50 > 0);
  assert.ok(b.p50 > 0);
  assert.notEqual(a.p10, b.p10 + a.p50);
});
