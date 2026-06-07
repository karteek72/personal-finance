import assert from "node:assert/strict";
import { test } from "node:test";

import type { CategoryRule } from "../category-rules.js";
import { classifyBankingTransaction } from "../classify-banking-transaction.js";
import { enrichBankingTransactionClassification } from "../import/enrich-classification.js";

const emptyRules = new Map<string, CategoryRule>();

test("classifyBankingTransaction infers category and subcategory from Uncategorized hint", () => {
  const result = classifyBankingTransaction({
    categoryHint: "Uncategorized",
    name: "COSTCO WHSE #1234",
    merchantName: "COSTCO WHSE #1234",
    categoryRules: emptyRules,
    transactionType: "expense",
    isTransfer: false,
  });

  assert.equal(result.category, "Food & Groceries");
  assert.equal(result.subCategory, "Grocery Stores");
});

test("classifyBankingTransaction resolves credit card payments as internal transfers", () => {
  const result = classifyBankingTransaction({
    categoryHint: "Uncategorized",
    name: "ONLINE SCHEDULED PAYMENT THANK YOU",
    merchantName: "AMERICAN EXPRESS",
    categoryRules: emptyRules,
    transactionType: "expense",
    isTransfer: false,
  });

  assert.equal(result.category, "Transfers (internal)");
  assert.equal(result.subCategory, "Credit Card Payments");
  assert.equal(result.transactionType, "transfer");
  assert.equal(result.isTransfer, true);
});

test("classifyBankingTransaction applies user merchant rules", () => {
  const rules = new Map<string, CategoryRule>([
    ["costco whse #1234", { category: "Shopping & Retail", subCategory: "Department Stores" }],
  ]);

  const result = classifyBankingTransaction({
    categoryHint: "Food & Groceries",
    name: "COSTCO WHSE #1234",
    merchantName: "COSTCO WHSE #1234",
    categoryRules: rules,
    transactionType: "expense",
    isTransfer: false,
  });

  assert.equal(result.category, "Shopping & Retail");
  assert.equal(result.subCategory, "Department Stores");
});

test("classifyBankingTransaction normalizes legacy parser category hints", () => {
  const result = classifyBankingTransaction({
    categoryHint: "Transport & Gas",
    name: "RACETRAC 123",
    merchantName: "RACETRAC 123",
    categoryRules: emptyRules,
    transactionType: "expense",
    isTransfer: false,
  });

  assert.equal(result.category, "Transportation");
  assert.equal(result.subCategory, "Gas & Fuel");
});

test("enrichBankingTransactionClassification attaches subCategory to parsed txn", () => {
  const enriched = enrichBankingTransactionClassification(
    {
      externalId: "csv:1",
      date: "2024-01-15",
      name: "CURSOR USAGE",
      merchantName: "CURSOR USAGE",
      amount: "20.00",
      transactionType: "expense",
      isTransfer: false,
      category: "Uncategorized",
    },
    emptyRules,
  );

  assert.equal(enriched.category, "Subscriptions & Software");
  assert.equal(enriched.subCategory, "AI Tools");
});
