import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { detectCsvTemplate, parseCsvStatement } from "../parse-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "..", "__fixtures__");

function loadFixture(name: string): string {
  return readFileSync(resolve(fixtures, name), "utf8");
}

test("detectCsvTemplate identifies Schwab headers after account-info rows", () => {
  const content = loadFixture("schwab-transactions.csv");
  assert.equal(detectCsvTemplate(content), "schwab-transactions");
});

test("parseCsvStatement parses Schwab trades skipping prefix rows", () => {
  const content = loadFixture("schwab-transactions.csv");
  const stmt = parseCsvStatement(content, "schwab-87654321.csv");

  assert.equal(stmt.formatVersion, "schwab-transactions");
  assert.equal(stmt.account.institutionName, "Charles Schwab");
  assert.equal(stmt.investmentTransactions.length, 2);
});

test("detectCsvTemplate identifies Robinhood activity", () => {
  const content = loadFixture("robinhood-activity.csv");
  assert.equal(detectCsvTemplate(content), "robinhood-activity");
});

test("parseCsvStatement parses Robinhood trades and skips ACH", () => {
  const content = loadFixture("robinhood-activity.csv");
  const stmt = parseCsvStatement(content, "robinhood.csv");

  assert.equal(stmt.investmentTransactions.length, 2);
  assert.equal(stmt.investmentTransactions[0]?.type, "buy");
});

test("detectCsvTemplate identifies Coinbase transaction history", () => {
  const content = loadFixture("coinbase-tx-history.csv");
  assert.equal(detectCsvTemplate(content), "coinbase-tx-history");
});

test("parseCsvStatement maps Coinbase crypto with assetType crypto", () => {
  const content = loadFixture("coinbase-tx-history.csv");
  const stmt = parseCsvStatement(content, "coinbase-2024.csv");

  assert.equal(stmt.account.subtype, "crypto");
  assert.equal(stmt.investmentTransactions.length, 2);
  assert.equal(stmt.investmentTransactions[0]?.assetType, "crypto");
  assert.equal(stmt.investmentTransactions[0]?.ticker, "BTC");
});

test("detectCsvTemplate identifies SoFi checking", () => {
  const content = loadFixture("sofi-checking.csv");
  assert.equal(detectCsvTemplate(content), "sofi-checking");
});

test("parseCsvStatement parses SoFi checking into banking transactions", () => {
  const content = loadFixture("sofi-checking.csv");
  const stmt = parseCsvStatement(content, "sofi-checking.csv");

  assert.equal(stmt.formatVersion, "sofi-checking");
  assert.equal(stmt.account.type, "depository");
  assert.equal(stmt.bankingTransactions.length, 2);
  assert.equal(stmt.investmentTransactions.length, 0);
});
