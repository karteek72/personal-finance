import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { detectPdfInstitution } from "../pdf/detect-institution.js";
import { parseSofiInvestText } from "../pdf/sofi-invest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "..", "__fixtures__");

test("detectPdfInstitution identifies SoFi Invest", () => {
  const text = readFileSync(resolve(fixtures, "sofi-invest-sample.txt"), "utf8");
  assert.equal(detectPdfInstitution(text), "sofi-invest");
});

test("parseSofiInvestText extracts trades from layout text", () => {
  const text = readFileSync(resolve(fixtures, "sofi-invest-sample.txt"), "utf8");
  const stmt = parseSofiInvestText(text, "sofi-invest-jan.pdf");

  assert.equal(stmt.formatVersion, "sofi-invest");
  assert.equal(stmt.account.institutionName, "SoFi");
  assert.equal(stmt.investmentTransactions.length, 2);
  assert.equal(stmt.investmentTransactions[0]?.ticker, "AAPL");
});

test("detectPdfInstitution returns null for unknown PDF text", () => {
  assert.equal(detectPdfInstitution("Random Bank Statement\nAccount 1234"), null);
});
