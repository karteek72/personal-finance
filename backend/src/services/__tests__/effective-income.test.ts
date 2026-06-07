import assert from "node:assert/strict";
import test from "node:test";
import { resolveEffectiveMonthlyIncomeFromValues } from "../effective-income.js";

test("uses stated income when detected is unreliable", () => {
  const result = resolveEffectiveMonthlyIncomeFromValues(200, 10_000);
  assert.equal(result.source, "stated");
  assert.equal(result.monthlyIncome, 10_000);
  assert.ok(result.caveats.length > 0);
});

test("uses detected income when reliable", () => {
  const result = resolveEffectiveMonthlyIncomeFromValues(9_500, 10_000);
  assert.equal(result.source, "detected");
  assert.equal(result.monthlyIncome, 9_500);
  assert.equal(result.caveats.length, 0);
});

test("flags discrepancy between stated and detected income", () => {
  const result = resolveEffectiveMonthlyIncomeFromValues(6_000, 10_000);
  assert.equal(result.source, "detected_with_caveat");
  assert.equal(result.monthlyIncome, 6_000);
  assert.ok(result.caveats.some((c) => c.includes("differs")));
});
