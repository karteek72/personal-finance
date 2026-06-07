import { createHash } from "node:crypto";
import { buildInvestmentIdentity } from "../account-key.js";
import { parseMoney } from "../csv-parse.js";
import type { ParsedInvestmentTransaction, ParsedStatement } from "../types.js";
import { dateFromMd, inferStatementYear, parsePdfMoney } from "./pdf-utils.js";

const INSTITUTION = "Fidelity";

function externalId(parts: string[]): string {
  const hash = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
  return `pdf:fidelity:${hash}`;
}

const tradeRe =
  /^(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(.+?)\s+([A-Z]{1,6})\s+(Bought|Sold)\s+([\d,.]+)\s+\$?([\d,.]+)\s+(-?\$?[\d,.]+)\s*$/i;

/**
 * Fidelity year-end / account statement PDF (pdftotext -layout).
 * Parses "Trades Pending Settlement" rows; full-year history may be absent on year-end reports.
 */
export function parseFidelityPdfText(
  text: string,
  filename: string,
): ParsedStatement[] {
  const year = inferStatementYear(text, filename);
  const byAccount = new Map<string, ParsedInvestmentTransaction[]>();

  let currentAccount = "unknown";

  for (const line of text.split("\n")) {
    const acct =
      line.match(/Account #\s*([X\d-]+)/i) ??
      line.match(/Account\s+Number:\s*([X\d-]+)/i);
    if (acct?.[1]) {
      currentAccount = acct[1].replace(/\s/g, "");
      if (!byAccount.has(currentAccount)) {
        byAccount.set(currentAccount, []);
      }
    }

    const trimmed = line.trim();
    const m = trimmed.match(tradeRe);
    if (!m) {
      continue;
    }

    if (!byAccount.has(currentAccount)) {
      byAccount.set(currentAccount, []);
    }

    const tradeMd = m[1]!;
    const settleMd = m[2]!;
    const [tmm] = tradeMd.split("/");
    const [smm] = settleMd.split("/");
    let settleYear = year;
    if (Number(smm) < Number(tmm)) {
      settleYear += 1;
    }
    const date = dateFromMd(settleMd, settleYear);
    if (!date) {
      continue;
    }

    const securityName = m[3]!.replace(/\s+/g, " ").trim();
    const symbol = m[4]!.toUpperCase();
    const side = m[5]!.toUpperCase();
    const type = side === "BOUGHT" ? "buy" : side === "SOLD" ? "sell" : null;
    if (!type) {
      continue;
    }

    const qty = parseMoney(m[6]!);
    const price = parseMoney(m[7]!);
    const amountNum = Number.parseFloat(parsePdfMoney(m[8]!));
    const amount =
      type === "buy"
        ? (-Math.abs(amountNum)).toFixed(2)
        : Math.abs(amountNum).toFixed(2);

    byAccount.get(currentAccount)!.push({
      externalId: externalId([currentAccount, date, symbol, side, qty, price]),
      date,
      name: `${side} ${securityName}`,
      type,
      ticker: symbol,
      securityName,
      quantity: qty,
      price,
      amount,
      fees: "0.00",
    });
  }

  const warningSparse =
    "Fidelity year-end statements often list only pending settlement trades, not full purchase/sale history. Upload Fidelity Activity CSV for complete history when available.";

  if (byAccount.size === 0) {
    return [
      {
        format: "pdf",
        formatVersion: "fidelity-year-end",
        sourceFilename: filename,
        account: buildInvestmentIdentity(INSTITUTION, "unknown", "Fidelity"),
        bankingTransactions: [],
        investmentTransactions: [],
        warnings: ["No Fidelity account or trades found in PDF."],
      },
    ];
  }

  return [...byAccount.entries()].map(([accountRaw, txns]) => ({
    format: "pdf" as const,
    formatVersion: "fidelity-year-end",
    sourceFilename: filename,
    account: buildInvestmentIdentity(
      INSTITUTION,
      accountRaw,
      `Fidelity ${accountRaw}`,
    ),
    bankingTransactions: [],
    investmentTransactions: txns,
    warnings: txns.length === 0 ? [warningSparse] : [],
  }));
}
