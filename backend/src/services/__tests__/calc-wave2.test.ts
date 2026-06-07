import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidCategory,
  isValidSubCategory,
  SUBCATEGORY_MAP,
} from "../../config/categories.js";
import {
  analyticsCategoryRefs,
  assertAnalyticsCategoriesInTaxonomy,
} from "../analytics-categories.js";
import { habitMatcherTaxonomyRefs } from "../lifestyle-habits.js";
import { splitBalanceForNetWorth } from "../../config/account-types.js";
import {
  deltaPercentVsPrior,
  priorComparablePeriod,
} from "../../lib/date-range.js";
import { rankTrendCategoriesBySpend } from "../transaction-store.js";

test("analytics category refs exist in config/categories.ts taxonomy", () => {
  assert.doesNotThrow(() => assertAnalyticsCategoriesInTaxonomy());
  for (const name of analyticsCategoryRefs()) {
    assert.ok(isValidCategory(name), `missing category: ${name}`);
  }
});

test("lifestyle habit matcher refs exist in config/categories.ts taxonomy", () => {
  for (const ref of habitMatcherTaxonomyRefs()) {
    for (const category of ref.categories) {
      assert.ok(
        isValidCategory(category),
        `${ref.habitId}: unknown category ${category}`,
      );
    }
    for (const subCategory of ref.subCategories) {
      const parentFromRef = ref.categories.find((cat) =>
        isValidSubCategory(cat, subCategory),
      );
      const parentFromMap = Object.entries(SUBCATEGORY_MAP).find(([, subs]) =>
        (subs as readonly string[]).includes(subCategory),
      )?.[0];
      const parent = parentFromRef ?? parentFromMap;
      assert.ok(
        parent && isValidSubCategory(parent, subCategory),
        `${ref.habitId}: unknown subcategory ${subCategory}`,
      );
    }
  }
});

test("subscription category matches canonical Subscriptions & Software", () => {
  const subs = analyticsCategoryRefs().filter((c) =>
    c.toLowerCase().includes("subscription"),
  );
  assert.deepEqual(subs, ["Subscriptions & Software"]);
  assert.ok(
    SUBCATEGORY_MAP["Subscriptions & Software"].includes("Streaming Video"),
  );
});

test("priorComparablePeriod returns same-length window before from", () => {
  const { priorFrom, priorTo } = priorComparablePeriod("2026-05-01", "2026-05-31");
  assert.equal(priorFrom, "2026-03-31");
  assert.equal(priorTo, "2026-04-30");

  const twoMonth = priorComparablePeriod("2026-05-01", "2026-06-30");
  assert.equal(twoMonth.priorFrom, "2026-03-01");
  assert.equal(twoMonth.priorTo, "2026-04-30");
});

test("deltaPercentVsPrior avoids divide-by-zero for new categories", () => {
  assert.equal(deltaPercentVsPrior(100, 0), 0);
  assert.equal(deltaPercentVsPrior(150, 100), 50);
  assert.equal(deltaPercentVsPrior(80, 100), -20);
});

test("rankTrendCategoriesBySpend orders by total spend not alphabetically", () => {
  const rows = [
    { name: "Travel", amount: "50.00" },
    { name: "Food & Groceries", amount: "200.00" },
    { name: "Travel", amount: "30.00" },
    { name: "Dining & Restaurants", amount: "120.00" },
  ];
  const byCategory = new Map([
    ["Travel", [{ month: "2026-05", amount: "80.00" }]],
    ["Food & Groceries", [{ month: "2026-05", amount: "200.00" }]],
    ["Dining & Restaurants", [{ month: "2026-05", amount: "120.00" }]],
    ["Entertainment", [{ month: "2026-05", amount: "10.00" }]],
  ]);
  const ranked = rankTrendCategoriesBySpend(byCategory.entries(), rows, 3);
  assert.deepEqual(
    ranked.map((t) => t.name),
    ["Food & Groceries", "Dining & Restaurants", "Travel"],
  );
});

test("splitBalanceForNetWorth treats loan balances as liabilities", () => {
  const mortgage = splitBalanceForNetWorth("loan", 250_000);
  assert.equal(mortgage.assets, 0);
  assert.equal(mortgage.liabilities, 250_000);

  const checking = splitBalanceForNetWorth("depository", 5000);
  assert.equal(checking.assets, 5000);
  assert.equal(checking.liabilities, 0);

  const credit = splitBalanceForNetWorth("credit", 1200);
  const net =
    checking.assets - mortgage.liabilities - credit.liabilities;
  assert.equal(net, 5000 - 250_000 - 1200);
});

test("transfer outflow dedupe counts paired legs once", () => {
  const legs = [
    { date: "2026-05-01", amount: 500 },
    { date: "2026-05-01", amount: 500 },
  ];
  const deduped = new Map<string, number>();
  for (const leg of legs) {
    const key = `${leg.date}:${leg.amount}`;
    deduped.set(key, leg.amount);
  }
  const total = [...deduped.values()].reduce((s, n) => s + n, 0);
  assert.equal(total, 500);
});
