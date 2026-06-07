import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeMerchant } from "../merchant-normalizer.js";

function key(
  merchantName: string | null | undefined,
  name: string,
): string | null {
  return normalizeMerchant(merchantName, name)?.canonicalKey ?? null;
}

test("normalizeMerchant strips SQ * processor prefix", () => {
  assert.equal(key("SQ *BLUE BOTTLE COFFEE", "SQ *BLUE BOTTLE COFFEE"), "blue bottle coffee");
});

test("normalizeMerchant strips TST* prefix", () => {
  assert.equal(key("TST* DOORDASH", "TST* DOORDASH"), "doordash");
});

test("normalizeMerchant strips store numbers", () => {
  assert.equal(key("STARBUCKS STORE #12345", "STARBUCKS STORE #12345"), "starbucks");
  assert.equal(key("COSTCO WHSE #1234", "COSTCO WHSE #1234"), "costco whse");
});

test("normalizeMerchant strips trailing store digits", () => {
  assert.equal(key("WALMART 1234", "WALMART 1234"), "walmart");
});

test("normalizeMerchant strips trailing city and state", () => {
  assert.equal(
    key("UBER EATS SAN FRANCISCO CA", "UBER EATS SAN FRANCISCO CA"),
    "uber eats",
  );
  assert.equal(key("TARGET SEATTLE WA", "TARGET SEATTLE WA"), "target");
});

test("normalizeMerchant strips trailing zip codes", () => {
  assert.equal(key("WHOLE FOODS 123 Main 94107", "WHOLE FOODS 123 Main 94107"), "whole foods 123 main");
});

test("normalizeMerchant collapses variants to the same canonical key", () => {
  const a = key("STARBUCKS STORE #12345", "STARBUCKS STORE #12345");
  const b = key("STARBUCKS STORE #67890", "STARBUCKS STORE #67890");
  assert.equal(a, b);
});

test("normalizeMerchant uses transaction name when merchant name is missing", () => {
  assert.equal(key(null, "NETFLIX.COM"), "netflix.com");
});

test("normalizeMerchant returns null for blank input", () => {
  assert.equal(normalizeMerchant(null, "   "), null);
});

test("normalizeMerchant produces a title-case display name", () => {
  const result = normalizeMerchant("sq *blue bottle coffee", "sq *blue bottle coffee");
  assert.equal(result?.displayName, "Blue Bottle Coffee");
});
