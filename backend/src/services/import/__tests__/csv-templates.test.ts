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

test("detectCsvTemplate identifies Fidelity headers", () => {
  const content = loadFixture("fidelity-activity.csv");
  assert.equal(detectCsvTemplate(content), "fidelity-activity");
});

test("detectCsvTemplate identifies E*TRADE headers", () => {
  const content = loadFixture("etrade-transactions.csv");
  assert.equal(detectCsvTemplate(content), "etrade-transactions");
});

test("detectCsvTemplate identifies Webull headers", () => {
  const content = loadFixture("webull-orders.csv");
  assert.equal(detectCsvTemplate(content), "webull-orders");
});

test("parseCsvStatement parses Fidelity trades", () => {
  const content = loadFixture("fidelity-activity.csv");
  const stmt = parseCsvStatement(content, "fidelity-3301.csv");

  assert.equal(stmt.formatVersion, "fidelity-activity");
  assert.equal(stmt.account.institutionName, "Fidelity");
  assert.equal(stmt.account.mask, "3301");
  assert.equal(stmt.investmentTransactions.length, 2);
  assert.equal(stmt.investmentTransactions[0]?.type, "buy");
  assert.equal(stmt.investmentTransactions[0]?.ticker, "AAPL");
});

test("parseCsvStatement parses E*TRADE trades", () => {
  const content = loadFixture("etrade-transactions.csv");
  const stmt = parseCsvStatement(content, "etrade-1234.csv");

  assert.equal(stmt.formatVersion, "etrade-transactions");
  assert.equal(stmt.account.institutionName, "E*TRADE");
  assert.equal(stmt.investmentTransactions.length, 2);
});

test("parseCsvStatement filters Webull non-filled orders", () => {
  const content = loadFixture("webull-orders.csv");
  const stmt = parseCsvStatement(content, "webull-export.csv");

  assert.equal(stmt.formatVersion, "webull-orders");
  assert.equal(stmt.investmentTransactions.length, 2);
  assert.ok(
    stmt.investmentTransactions.every((t) => t.externalId.startsWith("csv:webull:")),
  );
});
