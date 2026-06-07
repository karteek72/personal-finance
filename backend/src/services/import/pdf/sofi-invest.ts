import { createHash } from "node:crypto";
import { buildInvestmentIdentity } from "../account-key.js";
import { parseDateUs, parseMoney, parseSignedMoney } from "../csv-parse.js";
import type { ParsedInvestmentTransaction, ParsedStatement } from "../types.js";

function externalId(parts: string[]): string {
  const joined = parts.filter(Boolean).join("|");
  const hash = createHash("sha256").update(joined).digest("hex").slice(0, 16);
  return `pdf:sofi:${hash}`;
}

function extractAccountMask(text: string): string {
  const m =
    text.match(/Account\s*(?:Number|#)?\s*[:\s]*\*{0,4}(\d{4})/i) ??
    text.match(/ending\s+in\s+(\d{4})/i);
  return m?.[1] ?? "0000";
}

/**
 * Parse SoFi Invest statement text (output of pdftotext -layout).
 * Returns empty trades + warning if no trade table found (manual review).
 */
export function parseSofiInvestText(
  text: string,
  filename: string,
): ParsedStatement {
  const warnings: string[] = [];
  const mask = extractAccountMask(text);
  const accountRaw = mask === "0000" ? `sofi-${createHash("sha256").update(filename).digest("hex").slice(0, 8)}` : mask;

  const txns: ParsedInvestmentTransaction[] = [];

  const tradeSection = text.match(
    /Trade\s+Activity[\s\S]*?(?=Account Summary|Page \d|$)/i,
  )?.[0] ?? text;

  const lineRe =
    /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([A-Z0-9.-]{1,10})\s+(Buy|Sell|BUY|SELL)\s+([\d,.]+)\s+([\d,.]+)\s+(-?[\d,.]+)/gm;

  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(tradeSection)) !== null) {
    const date = parseDateUs(match[1]!);
    if (!date) {
      continue;
    }

    const symbol = match[2]!.toUpperCase();
    const side = match[3]!.toUpperCase();
    const type = side === "BUY" ? "buy" : side === "SELL" ? "sell" : null;
    if (!type) {
      continue;
    }

    const qty = parseMoney(match[4]!);
    const price = parseMoney(match[5]!);
    const amount = parseSignedMoney(match[6]!);

    txns.push({
      externalId: externalId([date, symbol, side, qty, price]),
      date,
      name: `${side} ${symbol}`,
      type,
      ticker: symbol,
      securityName: symbol,
      quantity: qty,
      price,
      amount,
      fees: "0.00",
    });
  }

  if (txns.length === 0) {
    warnings.push(
      "No trades extracted from SoFi Invest PDF — review the statement manually or export from another broker.",
    );
  }

  return {
    format: "pdf",
    formatVersion: "sofi-invest",
    sourceFilename: filename,
    account: buildInvestmentIdentity(
      "SoFi",
      accountRaw,
      "SoFi Invest",
      "brokerage",
    ),
    investmentTransactions: txns,
    bankingTransactions: [],
    warnings,
  };
}
