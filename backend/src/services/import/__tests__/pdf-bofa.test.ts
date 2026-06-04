import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { detectPdfInstitution } from "../pdf/detect-institution.js";
import {
  extractBofaAccountMask,
  parseBofaCreditCardText,
  parseBofaDepositoryText,
} from "../pdf/bofa-pdf.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "..", "__fixtures__");

test("detectPdfInstitution identifies BoFA credit card", () => {
  const text = readFileSync(resolve(fixtures, "bofa-credit-sample.txt"), "utf8");
  assert.equal(detectPdfInstitution(text), "bofa-credit");
});

test("detectPdfInstitution identifies BoFA checking", () => {
  const text = readFileSync(resolve(fixtures, "bofa-checking-sample.txt"), "utf8");
  assert.equal(detectPdfInstitution(text), "bofa-depository");
});

test("extractBofaAccountMask reads last four from header", () => {
  const text = readFileSync(resolve(fixtures, "bofa-credit-sample.txt"), "utf8");
  assert.equal(extractBofaAccountMask(text), "7138");
});

test("parseBofaCreditCardText extracts purchases and payments", () => {
  const text = readFileSync(resolve(fixtures, "bofa-credit-sample.txt"), "utf8");
  const stmt = parseBofaCreditCardText(text, "bofa-cc-jan-2024.pdf");

  assert.equal(stmt.formatVersion, "bofa-credit-card");
  assert.equal(stmt.account.institutionName, "Bank of America");
  assert.equal(stmt.account.type, "credit");
  assert.equal(stmt.bankingTransactions.length, 3);

  const payment = stmt.bankingTransactions.find((t) =>
    /THANK YOU/i.test(t.name),
  );
  assert.ok(payment);
  assert.equal(payment?.transactionType, "transfer");
});

test("parseBofaDepositoryText extracts checking transactions", () => {
  const text = readFileSync(resolve(fixtures, "bofa-checking-sample.txt"), "utf8");
  const stmt = parseBofaDepositoryText(text, "bofa-checking-jan-2024.pdf");

  assert.equal(stmt.account.type, "depository");
  assert.equal(stmt.bankingTransactions.length, 3);

  const payroll = stmt.bankingTransactions.find((t) => /PAYROLL/i.test(t.name));
  assert.ok(payroll);
  assert.equal(payroll?.transactionType, "income");
});
