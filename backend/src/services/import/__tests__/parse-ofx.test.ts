import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { parseOfxFile } from "../parse-ofx.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "..", "__fixtures__");

function loadFixture(name: string): string {
  return readFileSync(resolve(fixtures, name), "utf8");
}

test("parseOfxFile parses bank QFX with transactions", () => {
  const content = loadFixture("sample-bank.qfx");
  const statements = parseOfxFile(content, "bofa-checking.qfx");

  assert.equal(statements.length, 1);
  const stmt = statements[0]!;
  assert.equal(stmt.formatVersion, "ofx-bank");
  assert.equal(stmt.account.type, "depository");
  assert.equal(stmt.account.mask, "3210");
  assert.equal(stmt.bankingTransactions.length, 2);
  assert.equal(stmt.bankingTransactions[0]?.externalId, "ofx:20240115-001");
});

test("parseOfxFile parses investment QFX with trades", () => {
  const content = loadFixture("sample-investment.qfx");
  const statements = parseOfxFile(content, "fidelity-brokerage.qfx");

  assert.equal(statements.length, 1);
  const stmt = statements[0]!;
  assert.equal(stmt.formatVersion, "ofx-investment");
  assert.equal(stmt.account.type, "investment");
  assert.equal(stmt.account.institutionName, "Fidelity");
  assert.equal(stmt.investmentTransactions.length, 2);
  assert.equal(stmt.investmentTransactions[0]?.type, "buy");
  assert.equal(stmt.investmentTransactions[0]?.ticker, "AAPL");
});
