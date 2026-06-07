import assert from "node:assert/strict";
import test from "node:test";

import { SPEND_CATEGORIES } from "../../config/categories.js";
import {
  DIM_CATEGORY_DEFAULTS,
  resetDimCategoryCache,
} from "../dim-category-store.js";

test("DIM_CATEGORY_DEFAULTS covers every SPEND_CATEGORIES entry", () => {
  for (const category of SPEND_CATEGORIES) {
    assert.ok(
      DIM_CATEGORY_DEFAULTS[category],
      `missing dim_category default for ${category}`,
    );
  }
});

test("essential categories include housing and exclude dining", () => {
  assert.equal(DIM_CATEGORY_DEFAULTS["Housing & Home"]?.isEssential, true);
  assert.equal(DIM_CATEGORY_DEFAULTS["Dining & Restaurants"]?.isEssential, false);
});

test("spend classes partition expense categories", () => {
  const classes = new Set(
    Object.values(DIM_CATEGORY_DEFAULTS).map((row) => row.spendClass),
  );
  assert.ok(classes.has("fixed"));
  assert.ok(classes.has("variable"));
  assert.ok(classes.has("discretionary"));
});

test("resetDimCategoryCache clears cached map", () => {
  resetDimCategoryCache();
  assert.doesNotThrow(() => resetDimCategoryCache());
});
