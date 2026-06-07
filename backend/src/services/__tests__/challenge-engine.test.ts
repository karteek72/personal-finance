import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChallenges,
  computeDiningChallenge,
  computeNoSpendWeekendChallenge,
  computeSavingsChallenge,
} from "../challenge-engine.js";

test("computeDiningChallenge completes when under target", () => {
  const challenge = computeDiningChallenge({
    baselineMonthly: 500,
    monthSpend: 350,
    daysRemaining: 10,
  });
  assert.ok(challenge);
  assert.equal(challenge.complete, true);
  assert.equal(challenge.progressPercent, 100);
});

test("computeSavingsChallenge tracks monthly surplus progress", () => {
  const challenge = computeSavingsChallenge({
    monthIncome: 5000,
    monthSpending: 4200,
    daysRemaining: 12,
  });
  assert.ok(challenge);
  assert.equal(challenge.complete, true);
});

test("computeNoSpendWeekendChallenge marks complete with zero weekend spend", () => {
  const challenge = computeNoSpendWeekendChallenge({
    weekendSpend: 0,
    daysRemaining: 1,
  });
  assert.equal(challenge.complete, true);
});

test("buildChallenges returns up to three challenges", () => {
  const challenges = buildChallenges({
    baselineDining: 400,
    monthDining: 300,
    monthIncome: 6000,
    monthSpending: 4500,
    weekendSpend: 0,
    monthDaysRemaining: 15,
    weekendDaysRemaining: 1,
  });
  assert.ok(challenges.length >= 2);
  assert.ok(challenges.length <= 3);
});
