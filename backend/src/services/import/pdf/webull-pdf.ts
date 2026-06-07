import { createHash } from "node:crypto";
import { buildInvestmentIdentity } from "../account-key.js";
import { parseMoney, parseSignedMoney } from "../csv-parse.js";
import type { ParsedInvestmentTransaction, ParsedStatement } from "../types.js";
import { inferStatementYear, parsePdfDateLoose } from "./pdf-utils.js";

const INSTITUTION = "Webull";

function externalId(parts: string[]): string {
  const hash = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
  return `pdf:webull:${hash}`;
}

function extractWebullAccount(text: string, filename: string): string {
  const m =
    text.match(/Account Number:\s*([A-Z0-9]+)/i) ??
    text.match(/ACCOUNT NUMBER\s+([0-9A-Z-]+)/i);
  if (m?.[1]) {
    return m[1].replace(/-/g, "").toUpperCase();
  }
  const fname = filename.match(/(5MW\d+)/i);
  if (fname?.[1]) {
    return fname[1].toUpperCase();
  }
  return createHash("sha256").update(filename).digest("hex").slice(0, 8);
}

/**
 * Webull summary / Apex clearing statement PDF (pdftotext -layout).
 */
export function parseWebullPdfText(
  text: string,
  filename: string,
): ParsedStatement {
  const warnings: string[] = [];
  const accountRaw = extractWebullAccount(text, filename);
  const txns: ParsedInvestmentTransaction[] = [];

  parseWebullSummaryTrades(text, txns);
  parseWebullLegacyTrades(text, txns);

  if (txns.length === 0) {
    warnings.push(
      "No filled trades found in this Webull PDF (summary-only months have positions/cash only).",
    );
  }

  return {
    format: "pdf",
    formatVersion: "webull-statement",
    sourceFilename: filename,
    account: buildInvestmentIdentity(
      INSTITUTION,
      accountRaw,
      `Webull ••${accountRaw.slice(-4)}`,
    ),
    bankingTransactions: [],
    investmentTransactions: txns,
    warnings,
  };
}

/** New summary format: Trade Date / Settlement / B|S / Qty / Price / Net Amount */
function parseWebullSummaryTrades(
  text: string,
  txns: ParsedInvestmentTransaction[],
): void {
  const lineRe =
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([BS])\s+(-?[\d,.]+)\s+([\d,.]+)\s+(-?[\d,.]+)\s+(-?[\d,.]+)\s+(-?[\d,.]+)\s+(-?[\d,.]+)/;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(lineRe);
    if (!m) {
      continue;
    }

    const date = parsePdfDateLoose(m[1]!);
    const symbol = trimmed.slice(0, trimmed.indexOf(m[1]!)).trim().split(/\s+/)[0];
    if (!date || !symbol) {
      continue;
    }

    const side = m[3]!.toUpperCase();
    const type = side === "B" ? "buy" : side === "S" ? "sell" : null;
    if (!type) {
      continue;
    }

    const qty = parseMoney(m[4]!.replace(/^-/, ""));
    const price = parseMoney(m[5]!);
    const net = parseSignedMoney(m[9]!);
    const amount =
      type === "buy"
        ? (-Math.abs(Number.parseFloat(net))).toFixed(2)
        : Math.abs(Number.parseFloat(net)).toFixed(2);

    txns.push({
      externalId: externalId([date, symbol, side, qty, net]),
      date,
      name: `${type === "buy" ? "Buy" : "Sell"} ${symbol}`,
      type,
      ticker: symbol.split(/\s/)[0],
      securityName: trimmed.slice(0, trimmed.indexOf(m[1]!)).trim(),
      quantity: qty,
      price,
      amount,
      fees: "0.00",
    });
  }
}

/** Legacy Apex format: BOUGHT / SOLD rows */
function parseWebullLegacyTrades(
  text: string,
  txns: ParsedInvestmentTransaction[],
): void {
  const lineRe =
    /^(BOUGHT|SOLD)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+\w\s+(.+?)\s+([\d,]+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)/i;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(lineRe);
    if (!m) {
      continue;
    }

    const side = m[1]!.toUpperCase();
    const type = side === "BOUGHT" ? "buy" : "sell";
    const date = parsePdfDateLoose(m[2]!);
    if (!date) {
      continue;
    }

    const desc = m[4]!.replace(/\s+/g, " ").trim();
    const qty = parseMoney(m[5]!);
    const price = parseMoney(m[6]!);
    const debit = parseSignedMoney(m[7]!);
    const amount =
      type === "buy"
        ? (-Math.abs(Number.parseFloat(debit))).toFixed(2)
        : Math.abs(Number.parseFloat(debit)).toFixed(2);

    txns.push({
      externalId: externalId([date, side, desc, qty, price]),
      date,
      name: `${side} ${desc}`,
      type,
      ticker: undefined,
      securityName: desc,
      quantity: qty,
      price,
      amount,
      fees: "0.00",
    });
  }
}
