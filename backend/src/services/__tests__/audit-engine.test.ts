import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_LANES,
  DISCRETIONARY_CATEGORIES,
} from "../analytics-categories.js";
import {
  SPEND_CATEGORIES,
  SUBCATEGORY_MAP,
  isValidSubCategory,
} from "../../config/categories.js";
import {
  applyRecurringLifecycleFields,
  resolveRecurringLifecycle,
} from "../recurring-lifecycle.js";
import {
  futureValueMonthly,
  lapsedSubscriptionAudits,
  OPPORTUNITY_COST_ANNUAL_RATE,
} from "../cost-audit-engine.js";
import type { DetectedRecurringItem } from "../detect-recurring.js";

test("resolveRecurringLifecycle marks stale monthly sub as lapsed with null next date", () => {
  const result = resolveRecurringLifecycle("2026-01-01", 30, "2026-06-07");
  assert.equal(result.status, "lapsed");
  assert.equal(result.nextChargeDate, null);
});

test("resolveRecurringLifecycle keeps active sub with future next charge", () => {
  const result = resolveRecurringLifecycle("2026-05-15", 30, "2026-06-07");
  assert.equal(result.status, "active");
  assert.ok(result.nextChargeDate);
  assert.ok(result.nextChargeDate > "2026-06-07");
});

test("resolveRecurringLifecycle nulls nextChargeDate when prediction is in the past", () => {
  const result = resolveRecurringLifecycle("2026-05-01", 30, "2026-06-07");
  assert.equal(result.status, "active");
  assert.equal(result.nextChargeDate, null);
});

test("applyRecurringLifecycleFields maps price-changed on active items", () => {
  const result = applyRecurringLifecycleFields({
    lastChargeDate: "2026-05-15",
    cadence: "monthly",
    priceChanged: true,
  });
  assert.equal(result.status, "price-changed");
});

test("lapsedSubscriptionAudits surfaces confirm-cancellation savings", () => {
  const item: DetectedRecurringItem = {
    merchantName: "Adobe Creative Cloud",
    merchantKey: "adobe creative cloud",
    category: "Subscriptions & Software",
    kind: "subscription",
    amount: "54.99",
    cadence: "monthly",
    nextChargeDate: null,
    lastChargeDate: "2026-01-18",
    previousAmount: null,
    priceChanged: false,
    status: "lapsed",
    brandColor: "#FF0000",
    flags: {
      priceCreep: false,
      zombie: true,
      duplicate: false,
      freeTrialJump: false,
      confidence: 0.8,
      priceCreepPct: null,
    },
  };
  const audits = lapsedSubscriptionAudits([item], "2026-06-07");
  assert.equal(audits.length, 1);
  assert.equal(audits[0]!.type, "lapsed_subscription");
  assert.ok(audits[0]!.rationale.includes("Adobe Creative Cloud"));
  assert.equal(audits[0]!.savingsEstimate, "54.99");
});

test("futureValueMonthly uses documented 7% annual rate", () => {
  const fv10 = futureValueMonthly(100, 10, OPPORTUNITY_COST_ANNUAL_RATE);
  assert.ok(fv10 > 1000 && fv10 < 20000);
});

test("analytics category constants exist in taxonomy", () => {
  for (const cat of SUBSCRIPTION_CATEGORIES) {
    assert.ok(
      SPEND_CATEGORIES.includes(cat as (typeof SPEND_CATEGORIES)[number]),
      `missing subscription category: ${cat}`,
    );
  }
  for (const cat of DISCRETIONARY_CATEGORIES) {
    assert.ok(
      SPEND_CATEGORIES.includes(cat as (typeof SPEND_CATEGORIES)[number]),
      `missing discretionary category: ${cat}`,
    );
  }
  const auditSubcategories = [
    "Cafes & Coffee",
    "Food Delivery",
    "Rideshare & Taxi",
    "Streaming Video",
    "Music & Podcasts",
    "Gaming",
    "Fitness & Gym",
  ] as const;
  const parentBySub: Record<(typeof auditSubcategories)[number], string> = {
    "Cafes & Coffee": "Dining & Restaurants",
    "Food Delivery": "Dining & Restaurants",
    "Rideshare & Taxi": "Transportation",
    "Streaming Video": "Subscriptions & Software",
    "Music & Podcasts": "Subscriptions & Software",
    Gaming: "Entertainment",
    "Fitness & Gym": "Health & Medical",
  };
  for (const sub of auditSubcategories) {
    const parent = parentBySub[sub];
    assert.ok(isValidSubCategory(parent, sub), `${sub} not under ${parent}`);
  }
  for (const lane of SUBSCRIPTION_LANES) {
    assert.ok(lane.id.length > 0);
    assert.ok(lane.pattern.test("netflix") || lane.id !== "streaming-video");
  }
  assert.ok(Object.keys(SUBCATEGORY_MAP).length >= SPEND_CATEGORIES.length - 2);
});
