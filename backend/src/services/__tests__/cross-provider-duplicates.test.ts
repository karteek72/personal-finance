import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectDuplicateAccountPairsFromRows,
} from "../cross-provider-duplicates.js";

test("detectDuplicateAccountPairsFromRows finds cross-provider same mask+institution", () => {
  const pairs = detectDuplicateAccountPairsFromRows([
    {
      id: "a1",
      name: "Chase Checking",
      mask: "1234",
      type: "depository",
      institutionName: "Chase",
      source: "plaid",
    },
    {
      id: "a2",
      name: "Chase Checking",
      mask: "1234",
      type: "depository",
      institutionName: "Chase",
      source: "teller",
    },
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.matchScore, 90);
  assert.notEqual(pairs[0]?.sourceA, pairs[0]?.sourceB);
});

test("detectDuplicateAccountPairsFromRows ignores same-provider pairs", () => {
  const pairs = detectDuplicateAccountPairsFromRows([
    {
      id: "a1",
      name: "Chase",
      mask: "1234",
      type: "depository",
      institutionName: "Chase",
      source: "plaid",
    },
    {
      id: "a2",
      name: "Chase duplicate item",
      mask: "1234",
      type: "depository",
      institutionName: "Chase",
      source: "plaid",
    },
  ]);
  assert.equal(pairs.length, 0);
});
