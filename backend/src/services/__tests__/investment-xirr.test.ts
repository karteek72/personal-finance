import assert from "node:assert/strict";
import test from "node:test";

import { computeXirr } from "../investment/xirr.js";

test("XIRR: single year 10% return", () => {
  const rate = computeXirr([
    { date: "2024-01-01", amount: -1000 },
    { date: "2025-01-01", amount: 1100 },
  ]);
  assert.ok(rate != null);
  assert.ok(Math.abs(rate - 0.1) < 0.001, `expected ~0.10, got ${rate}`);
});

test("XIRR: irregular cashflows (Excel-style)", () => {
  const rate = computeXirr([
    { date: "2008-01-01", amount: -10_000 },
    { date: "2008-03-03", amount: 2750 },
    { date: "2008-10-30", amount: 4250 },
    { date: "2009-02-15", amount: 3250 },
    { date: "2009-04-01", amount: 2750 },
  ]);
  assert.ok(rate != null);
  assert.ok(Math.abs(rate - 0.3734) < 0.01, `expected ~37.34%, got ${rate}`);
});

test("XIRR: returns null without both inflows and outflows", () => {
  assert.equal(
    computeXirr([{ date: "2024-01-01", amount: -1000 }]),
    null,
  );
  assert.equal(
    computeXirr([{ date: "2024-01-01", amount: 1000 }]),
    null,
  );
});

test("XIRR: terminal value included in series", () => {
  const rate = computeXirr([
    { date: "2024-01-01", amount: -5000 },
    { date: "2024-06-01", amount: 500 },
    { date: "2024-12-31", amount: 5200 },
  ]);
  assert.ok(rate != null);
  assert.ok(rate > 0);
});
