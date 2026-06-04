import assert from "node:assert/strict";
import { test } from "node:test";
import { detectIssuerCsv, parseIssuerCsv } from "../issuer-csv.js";

test("detectIssuerCsv identifies Amex export", () => {
  const content =
    "Date,Description,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category\n" +
    "01/15/2026,COFFEE SHOP,5.00,,COFFEE SHOP,,,,,ref1,Restaurant\n";
  assert.equal(detectIssuerCsv(content), "amex");
});

test("parseIssuerCsv parses Amex charges and payments", () => {
  const content =
    "Date,Description,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category\n" +
    "01/15/2026,COFFEE SHOP,5.00,,COFFEE SHOP,,,,,ref1,Restaurant\n" +
    "01/10/2026,MOBILE PAYMENT,-100.00,,MOBILE PAYMENT,,,,,ref2,Payments\n";
  const stmt = parseIssuerCsv("amex", content, "amexJan2026.csv");
  assert.equal(stmt.bankingTransactions.length, 2);
  assert.equal(stmt.formatVersion, "amex-activity");
});

test("detectIssuerCsv identifies Discover export", () => {
  const content =
    "Trans. Date,Post Date,Description,Amount,Category\n" +
    "06/18/2024,06/18/2024,STORE,14.59,Supermarkets\n";
  assert.equal(detectIssuerCsv(content), "discover");
});

test("parseIssuerCsv parses Citi card with long month dates", () => {
  const content = [
    '"Name:","Test User"',
    '"Card:","Card-7016"',
    "Date,Description,Debit,Credit,Category",
    '"May 27, 2026","MYQ SUBSCRIPTION",3.25,,Merchandise',
    '"May 20, 2026","AUTOPAY",,50.00,Payment',
  ].join("\n");
  assert.equal(detectIssuerCsv(content), "citi-card");
  const stmt = parseIssuerCsv("citi-card", content, "citi_7106.csv");
  assert.equal(stmt.bankingTransactions.length, 2);
  assert.equal(stmt.account.mask, "7016");
});
