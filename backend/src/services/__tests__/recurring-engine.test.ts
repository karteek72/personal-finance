import assert from "node:assert/strict";
import test from "node:test";

import {
  amountsSimilar,
  buildRecurringSeries,
  detectCadence,
  detectFreeTrialJump,
  detectPriceCreep,
  linearRegressionSlope,
  markDuplicateFlags,
} from "../recurring-engine.js";

test("detectCadence recognizes weekly, monthly, quarterly, and annual patterns", () => {
  assert.equal(detectCadence([7, 7, 7, 7]), "weekly");
  assert.equal(detectCadence([30, 31, 29, 30]), "monthly");
  assert.equal(detectCadence([91, 90, 92]), "quarterly");
  assert.equal(detectCadence([365, 364, 366]), "annual");
  assert.equal(detectCadence([17, 40, 11]), null);
});

test("detectPriceCreep flags upward regression trend", () => {
  const charges = [
    { date: "2026-01-01", amount: 10, category: "Subscriptions & Software" },
    { date: "2026-02-01", amount: 11, category: "Subscriptions & Software" },
    { date: "2026-03-01", amount: 12.5, category: "Subscriptions & Software" },
    { date: "2026-04-01", amount: 14, category: "Subscriptions & Software" },
  ];
  const result = detectPriceCreep(charges, "monthly");
  assert.equal(result.priceChanged, true);
  assert.ok((result.priceCreepPct ?? 0) >= 5);
});

test("detectFreeTrialJump catches trial-to-paid jump", () => {
  const charges = [
    { date: "2026-01-01", amount: 0, category: "Subscriptions & Software" },
    { date: "2026-02-01", amount: 14.99, category: "Subscriptions & Software" },
  ];
  assert.equal(detectFreeTrialJump(charges), true);
});

test("markDuplicateFlags marks same-category similar-amount series", () => {
  const series = buildRecurringSeries(
    new Map([
      [
        "netflix",
        {
          displayName: "Netflix",
          charges: [
            { date: "2026-01-01", amount: 15.99, category: "Subscriptions & Software" },
            { date: "2026-02-01", amount: 15.99, category: "Subscriptions & Software" },
            { date: "2026-03-01", amount: 15.99, category: "Subscriptions & Software" },
          ],
        },
      ],
      [
        "hulu",
        {
          displayName: "Hulu",
          charges: [
            { date: "2026-01-05", amount: 16.49, category: "Subscriptions & Software" },
            { date: "2026-02-05", amount: 16.49, category: "Subscriptions & Software" },
            { date: "2026-03-05", amount: 16.49, category: "Subscriptions & Software" },
          ],
        },
      ],
    ]),
  );
  const dupes = markDuplicateFlags(series, new Set());
  assert.equal(dupes.get("netflix"), true);
  assert.equal(dupes.get("hulu"), true);
  assert.ok(amountsSimilar(15.99, 16.49));
});

test("linearRegressionSlope is positive for rising charges", () => {
  assert.ok(linearRegressionSlope([9.99, 11.99, 13.99, 15.99]) > 0);
});
