import { createHash } from "node:crypto";
import { buildDepositoryIdentity, buildInvestmentIdentity } from "./account-key.js";
import {
  headerIndexMap,
  parseCsvRows,
  parseDateUs,
  parseMoney,
  parseSignedMoney,
  rowValue,
} from "./csv-parse.js";
import {
  mapCoinbaseTransactionType,
  mapInvestmentAction,
  mapRobinhoodTransCode,
} from "./map-action.js";
import type { ParsedBankingTransaction, ParsedInvestmentTransaction, ParsedStatement } from "./types.js";

function externalId(prefix: string, parts: string[]): string {
  const joined = parts.filter(Boolean).join("|");
  if (joined.length < 120) {
    return `${prefix}:${joined}`;
  }
  const hash = createHash("sha256").update(joined).digest("hex").slice(0, 16);
  return `${prefix}:${hash}`;
}

export function parseFidelityActivityCsv(
  content: string,
  filename: string,
): ParsedStatement {
  const rows = parseCsvRows(content);
  const headerRowIdx = rows.findIndex((r) =>
    r.some((c) => normalize(c) === "run date"),
  );
  if (headerRowIdx < 0) {
    throw new Error("Fidelity CSV: header row not found");
  }

  const headers = rows[headerRowIdx]!;
  const map = headerIndexMap(headers);
  const warnings: string[] = [];
  const txns: ParsedInvestmentTransaction[] = [];

  let accountRaw = "";
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const acct = rowValue(row, map, "Account", "Account Number");
    if (acct) {
      accountRaw = acct;
    }
  }
  if (!accountRaw) {
    accountRaw = inferAccountFromFilename(filename, "fidelity");
    warnings.push("Account number not found in CSV; inferred from filename");
  }

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const dateRaw = rowValue(row, map, "Run Date", "Date");
    const date = parseDateUs(dateRaw);
    if (!date) {
      continue;
    }

    const action = rowValue(row, map, "Action");
    const type = mapInvestmentAction(action);
    if (!type) {
      continue;
    }

    const symbol = rowValue(row, map, "Symbol").toUpperCase();
    const qty = rowValue(row, map, "Quantity");
    const price = rowValue(row, map, "Price");
    const amount = parseSignedMoney(rowValue(row, map, "Amount"));
    const fees = parseMoney(
      rowValue(row, map, "Commission", "Fees", "Commissions and Fees"),
    );
    const desc = rowValue(row, map, "Description", "Security Description");
    const ref = rowValue(row, map, "Reference", "Settlement Date", "Run Date");

    txns.push({
      externalId: externalId("csv:fidelity", [date, symbol, action, qty, ref]),
      date,
      name: desc || `${action} ${symbol}`.trim(),
      type,
      ticker: symbol || undefined,
      securityName: desc || symbol,
      quantity: qty || undefined,
      price: price || undefined,
      amount,
      fees,
    });
  }

  return {
    format: "csv",
    formatVersion: "fidelity-activity",
    sourceFilename: filename,
    account: buildInvestmentIdentity(
      "Fidelity",
      accountRaw,
      "Fidelity Brokerage",
    ),
    investmentTransactions: txns,
    bankingTransactions: [],
    warnings,
  };
}

export function parseEtradeTransactionsCsv(
  content: string,
  filename: string,
): ParsedStatement {
  const rows = parseCsvRows(content);
  const headerRowIdx = rows.findIndex(
    (r) =>
      r.some((c) => normalize(c) === "transactiondate") ||
      r.some((c) => normalize(c) === "transaction date"),
  );
  if (headerRowIdx < 0) {
    throw new Error("E*TRADE CSV: header row not found");
  }

  const map = headerIndexMap(rows[headerRowIdx]!);
  const warnings: string[] = [];
  const txns: ParsedInvestmentTransaction[] = [];

  let accountRaw = "";
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const acct = rowValue(rows[i]!, map, "Account", "Account Number");
    if (acct) {
      accountRaw = acct;
    }
  }
  if (!accountRaw) {
    accountRaw = inferAccountFromFilename(filename, "etrade");
    warnings.push("Account number not found in CSV; inferred from filename");
  }

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const dateRaw = rowValue(
      row,
      map,
      "TransactionDate",
      "Transaction Date",
      "Date",
    );
    const date = parseDateUs(dateRaw);
    if (!date) {
      continue;
    }

    const txnType = rowValue(
      row,
      map,
      "TransactionType",
      "Transaction Type",
      "Type",
    );
    const type = mapInvestmentAction(txnType);
    if (!type) {
      continue;
    }

    const symbol = rowValue(row, map, "Symbol", "Security").toUpperCase();
    const qty = rowValue(row, map, "Quantity", "Qty");
    const price = rowValue(row, map, "Price");
    const amount = parseSignedMoney(
      rowValue(row, map, "Amount", "Net Amount", "Total Amount"),
    );
    const fees = parseMoney(rowValue(row, map, "Commission", "Fees"));
    const desc = rowValue(row, map, "Description", "Security Description");
    const txnId = rowValue(row, map, "TransactionID", "Transaction ID", "Id");

    txns.push({
      externalId: externalId("csv:etrade", [txnId || date, symbol, txnType, qty]),
      date,
      name: desc || `${txnType} ${symbol}`.trim(),
      type,
      ticker: symbol || undefined,
      securityName: desc || symbol,
      quantity: qty || undefined,
      price: price || undefined,
      amount,
      fees,
    });
  }

  return {
    format: "csv",
    formatVersion: "etrade-transactions",
    sourceFilename: filename,
    account: buildInvestmentIdentity("E*TRADE", accountRaw, "E*TRADE Brokerage"),
    investmentTransactions: txns,
    bankingTransactions: [],
    warnings,
  };
}

export function parseWebullOrdersCsv(
  content: string,
  filename: string,
): ParsedStatement {
  const rows = parseCsvRows(content);
  const headerRowIdx = rows.findIndex(
    (r) =>
      r.some((c) => normalize(c) === "symbol") &&
      (r.some((c) => normalize(c) === "side") ||
        r.some((c) => normalize(c) === "status")),
  );
  if (headerRowIdx < 0) {
    throw new Error("Webull CSV: header row not found");
  }

  const map = headerIndexMap(rows[headerRowIdx]!);
  const warnings: string[] = [];
  const txns: ParsedInvestmentTransaction[] = [];

  const accountRaw =
    rowValue(rows[headerRowIdx + 1] ?? [], map, "Account") ||
    inferAccountFromFilename(filename, "webull");

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const status = rowValue(row, map, "Status").toUpperCase();
    if (status && status !== "FILLED") {
      continue;
    }

    const dateRaw = rowValue(
      row,
      map,
      "Filled Time",
      "FilledTime",
      "Create Time",
      "Date",
    );
    const date = parseDateUs(dateRaw.split(" ")[0] ?? dateRaw);
    if (!date) {
      continue;
    }

    const side = rowValue(row, map, "Side");
    const type =
      side.toUpperCase() === "BUY"
        ? "buy"
        : side.toUpperCase() === "SELL"
          ? "sell"
          : mapInvestmentAction(side);
    if (!type) {
      continue;
    }

    const symbol = rowValue(row, map, "Symbol", "Ticker").toUpperCase();
    const qty = rowValue(row, map, "Filled", "Quantity", "Qty");
    const price = rowValue(row, map, "Avg Price", "Average Price", "Price");
    const amountNum =
      Number.parseFloat(parseMoney(qty)) *
      Number.parseFloat(parseMoney(price || "0"));
    const amount = Number.isFinite(amountNum)
      ? (type === "sell" ? amountNum : -amountNum).toFixed(2)
      : "0.00";
    const name = rowValue(row, map, "Name", "Symbol") || symbol;

    txns.push({
      externalId: externalId("csv:webull", [date, symbol, side, qty, price]),
      date,
      name: `${side} ${name}`.trim(),
      type,
      ticker: symbol || undefined,
      securityName: name,
      quantity: qty || undefined,
      price: price || undefined,
      amount,
      fees: "0.00",
    });
  }

  if (txns.length === 0) {
    warnings.push("No filled Webull orders found (cancelled/pending excluded)");
  }

  return {
    format: "csv",
    formatVersion: "webull-orders",
    sourceFilename: filename,
    account: buildInvestmentIdentity("Webull", accountRaw, "Webull Brokerage"),
    investmentTransactions: txns,
    bankingTransactions: [],
    warnings,
  };
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function inferAccountFromFilename(filename: string, broker: string): string {
  const match = filename.match(/(\d{4,})/);
  if (match) {
    return match[1]!;
  }
  return `${broker}-import-${createHash("sha256").update(filename).digest("hex").slice(0, 8)}`;
}

function findHeaderRowIndex(
  rows: string[][],
  required: string[],
): number {
  for (let i = 0; i < rows.length; i++) {
    const set = new Set(rows[i]!.map((c) => normalize(c)));
    if (required.every((h) => set.has(h))) {
      return i;
    }
  }
  return -1;
}

export function parseSchwabTransactionsCsv(
  content: string,
  filename: string,
): ParsedStatement {
  const rows = parseCsvRows(content);
  const headerRowIdx = findHeaderRowIndex(rows, [
    "date",
    "action",
    "symbol",
    "quantity",
    "price",
  ]);
  if (headerRowIdx < 0) {
    throw new Error("Schwab CSV: header row not found (skipped account-info rows)");
  }

  const map = headerIndexMap(rows[headerRowIdx]!);
  const warnings: string[] = [];
  const txns: ParsedInvestmentTransaction[] = [];

  let accountRaw = "";
  for (let i = 0; i < headerRowIdx; i++) {
    const row = rows[i]!;
    const joined = row.join(" ").toLowerCase();
    const acctMatch = joined.match(/account\s*(?:number|#)?\s*[,"']?\s*(\d{4,})/i);
    if (acctMatch) {
      accountRaw = acctMatch[1]!;
    }
    const acctCol = rowValue(row, headerIndexMap(row), "Account Number", "Account");
    if (acctCol) {
      accountRaw = acctCol.replace(/\D/g, "") || acctCol;
    }
  }
  if (!accountRaw) {
    accountRaw = inferAccountFromFilename(filename, "schwab");
    warnings.push("Account number not found in Schwab CSV prefix; inferred from filename");
  }

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const date = parseDateUs(rowValue(row, map, "Date"));
    if (!date) {
      continue;
    }

    const action = rowValue(row, map, "Action");
    const type = mapInvestmentAction(action);
    if (!type) {
      continue;
    }

    const symbol = rowValue(row, map, "Symbol").toUpperCase();
    const qty = rowValue(row, map, "Quantity", "Qty");
    const price = rowValue(row, map, "Price");
    const amount = parseSignedMoney(rowValue(row, map, "Amount"));
    const fees = parseMoney(rowValue(row, map, "Fees & Comm", "Fees", "Commission"));
    const desc = rowValue(row, map, "Description");

    txns.push({
      externalId: externalId("csv:schwab", [date, symbol, action, qty]),
      date,
      name: desc || `${action} ${symbol}`.trim(),
      type,
      ticker: symbol || undefined,
      securityName: desc || symbol,
      quantity: qty || undefined,
      price: price || undefined,
      amount,
      fees,
    });
  }

  return {
    format: "csv",
    formatVersion: "schwab-transactions",
    sourceFilename: filename,
    account: buildInvestmentIdentity(
      "Charles Schwab",
      accountRaw,
      "Schwab Brokerage",
    ),
    investmentTransactions: txns,
    bankingTransactions: [],
    warnings,
  };
}

export function parseRobinhoodActivityCsv(
  content: string,
  filename: string,
): ParsedStatement {
  const rows = parseCsvRows(content);
  const headerRowIdx = findHeaderRowIndex(rows, [
    "activity date",
    "instrument",
    "trans code",
  ]);
  if (headerRowIdx < 0) {
    throw new Error("Robinhood CSV: activity header row not found");
  }

  const map = headerIndexMap(rows[headerRowIdx]!);
  const warnings: string[] = [];
  const txns: ParsedInvestmentTransaction[] = [];
  const accountRaw = inferAccountFromFilename(filename, "robinhood");

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const date = parseDateUs(
      rowValue(row, map, "Activity Date", "Process Date", "Settle Date"),
    );
    if (!date) {
      continue;
    }

    const transCode = rowValue(row, map, "Trans Code");
    const type = mapRobinhoodTransCode(transCode);
    if (!type || type === "transfer") {
      continue;
    }

    const symbol = rowValue(row, map, "Instrument", "Symbol").toUpperCase();
    const qty = rowValue(row, map, "Quantity");
    const price = rowValue(row, map, "Price");
    const amount = parseSignedMoney(rowValue(row, map, "Amount"));
    const desc = rowValue(row, map, "Description");

    txns.push({
      externalId: externalId("csv:robinhood", [date, symbol, transCode, qty]),
      date,
      name: desc || `${transCode} ${symbol}`.trim(),
      type,
      ticker: symbol || undefined,
      securityName: desc || symbol,
      quantity: qty || undefined,
      price: price || undefined,
      amount,
      fees: "0.00",
    });
  }

  return {
    format: "csv",
    formatVersion: "robinhood-activity",
    sourceFilename: filename,
    account: buildInvestmentIdentity(
      "Robinhood",
      accountRaw,
      "Robinhood Brokerage",
    ),
    investmentTransactions: txns,
    bankingTransactions: [],
    warnings,
  };
}

export function parseCoinbaseTxHistoryCsv(
  content: string,
  filename: string,
): ParsedStatement {
  const rows = parseCsvRows(content);
  const headerRowIdx = findHeaderRowIndex(rows, [
    "timestamp",
    "transaction type",
    "asset",
  ]);
  if (headerRowIdx < 0) {
    throw new Error("Coinbase CSV: transaction history header not found");
  }

  const map = headerIndexMap(rows[headerRowIdx]!);
  const warnings: string[] = [];
  const txns: ParsedInvestmentTransaction[] = [];
  const accountRaw = inferAccountFromFilename(filename, "coinbase");

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const ts = rowValue(row, map, "Timestamp");
    const date = parseDateUs(ts.split("T")[0] ?? ts.split(" ")[0] ?? ts);
    if (!date) {
      continue;
    }

    const txnType = rowValue(row, map, "Transaction Type");
    const type = mapCoinbaseTransactionType(txnType);
    if (!type) {
      continue;
    }

    const asset = rowValue(row, map, "Asset", "Currency").toUpperCase();
    const qty = rowValue(row, map, "Quantity Transacted", "Quantity");
    const price = rowValue(row, map, "Spot Price at Transaction", "Spot Price");
    const amount = parseSignedMoney(
      rowValue(row, map, "Total (inclusive of fees and/or spread)", "Subtotal", "Amount"),
    );
    const fees = parseMoney(
      rowValue(row, map, "Fees and/or Spread", "Fees"),
    );

    txns.push({
      externalId: externalId("csv:coinbase", [ts, asset, txnType, qty]),
      date,
      name: `${txnType} ${asset}`.trim(),
      type,
      ticker: asset || undefined,
      securityName: asset,
      assetType: "crypto",
      quantity: qty || undefined,
      price: price || undefined,
      amount,
      fees,
    });
  }

  return {
    format: "csv",
    formatVersion: "coinbase-tx-history",
    sourceFilename: filename,
    account: buildInvestmentIdentity(
      "Coinbase",
      accountRaw,
      "Coinbase",
      "crypto",
    ),
    investmentTransactions: txns,
    bankingTransactions: [],
    warnings,
  };
}

export function parseSoFiCheckingCsv(
  content: string,
  filename: string,
): ParsedStatement {
  const rows = parseCsvRows(content);
  const headerRowIdx = findHeaderRowIndex(rows, [
    "date",
    "description",
    "type",
    "amount",
  ]);
  if (headerRowIdx < 0) {
    throw new Error("SoFi CSV: checking/savings header row not found");
  }

  const map = headerIndexMap(rows[headerRowIdx]!);
  const warnings: string[] = [];
  const banking: ParsedBankingTransaction[] = [];
  const accountRaw = inferAccountFromFilename(filename, "sofi");

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const date = parseDateUs(rowValue(row, map, "Date"));
    if (!date) {
      continue;
    }

    const name = rowValue(row, map, "Description");
    const typeCol = rowValue(row, map, "Type");
    const rawAmt = Number.parseFloat(parseSignedMoney(rowValue(row, map, "Amount")));
    const isDeposit = /deposit|credit|interest/i.test(typeCol) || rawAmt > 0;
    const amount = Math.abs(rawAmt).toFixed(2);

    banking.push({
      externalId: externalId("csv:sofi", [date, name, amount]),
      date,
      name,
      merchantName: name,
      amount,
      transactionType: isDeposit ? "income" : "expense",
      isTransfer: false,
      category: isDeposit ? "Income" : "Uncategorized",
    });
  }

  return {
    format: "csv",
    formatVersion: "sofi-checking",
    sourceFilename: filename,
    account: buildDepositoryIdentity("SoFi", accountRaw, "checking", "SoFi Checking"),
    investmentTransactions: [],
    bankingTransactions: banking,
    warnings,
  };
}
