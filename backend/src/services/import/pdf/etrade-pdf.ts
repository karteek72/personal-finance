import { createHash } from "node:crypto";
import { buildInvestmentIdentity } from "../account-key.js";
import { mapInvestmentAction } from "../map-action.js";
import { parseMoney } from "../csv-parse.js";
import type { ParsedInvestmentTransaction, ParsedStatement } from "../types.js";
import { dateFromMd, inferStatementYear, parsePdfMoney } from "./pdf-utils.js";

const INSTITUTION = "E*TRADE";

const ACCOUNT_HEADER_RE = /(\d{3}-\d{6}-\d{3})\s+SUBJECT TO STA RULES/i;

function externalId(accountRaw: string, parts: string[]): string {
  const hash = createHash("sha256")
    .update([accountRaw, ...parts].join("|"))
    .digest("hex")
    .slice(0, 16);
  return `pdf:etrade:${hash}`;
}

function normalizeEtradeAccountId(raw: string): string {
  return raw.replace(/-/g, "");
}

function extractDefaultEtradeAccount(text: string, filename: string): string {
  const acct = text.match(/\b(\d{3}-\d{6}-\d{3})\b/);
  if (acct?.[1]) {
    return normalizeEtradeAccountId(acct[1]);
  }

  const fname = filename.match(/_(\d{4})_/);
  if (fname?.[1]) {
    return fname[1];
  }

  return createHash("sha256").update(filename).digest("hex").slice(0, 8);
}

function mapEtradeAction(raw: string): ParsedInvestmentTransaction["type"] | null {
  const t = raw.trim();
  if (/^sold$/i.test(t) || /^sold short$/i.test(t)) {
    return /short/i.test(t) ? "sell_short" : "sell";
  }
  if (/^bought$/i.test(t) || /^bought to cover$/i.test(t)) {
    return "buy";
  }
  if (/transfer|ach|journal|automatic/i.test(t)) {
    return "transfer";
  }
  if (/interest/i.test(t)) {
    return "interest";
  }
  if (/dividend/i.test(t)) {
    return "dividend";
  }
  if (/rsu/i.test(t)) {
    return "transfer";
  }
  return mapInvestmentAction(t);
}

const tradeRe =
  /^(\d{1,2}\/\d{1,2})(?:\s+(\d{1,2}\/\d{1,2}))?\s+(Sold(?:\s+Short)?|Bought(?:\s+to\s+Cover)?)\s+(.+?)\s+(?:ACTED AS AGENT\s+)?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+(-?\$?\(?[\d,]+\.?\d{2}\)?)\s*$/i;

const transferRe =
  /^(\d{1,2}\/\d{1,2})(?:\s+(\d{1,2}\/\d{1,2}))?\s+(Online Transfer|Interest Income|Dividend|RSU|Automatic Investment|Automatic Redemption)\s+(.+?)\s+(-?\$?\(?[\d,]+\.?\d{2}\)?)\s*$/i;

const xferInRe =
  /^(\d{1,2}\/\d{1,2})\s+Transfer into Account\s+(.+?)\s+([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d{2})\s*$/i;

function ensureBucket(
  map: Map<string, ParsedInvestmentTransaction[]>,
  accountRaw: string,
): void {
  if (!map.has(accountRaw)) {
    map.set(accountRaw, []);
  }
}

/**
 * E*TRADE / Morgan Stanley at Work client statement PDF (pdftotext -layout).
 * Combined household PDFs emit one ParsedStatement per account number.
 */
export function parseEtradePdfText(
  text: string,
  filename: string,
): ParsedStatement[] {
  const year = inferStatementYear(text, filename);
  const defaultAccount = extractDefaultEtradeAccount(text, filename);
  const byAccount = new Map<string, ParsedInvestmentTransaction[]>();
  let currentAccount = defaultAccount;
  ensureBucket(byAccount, currentAccount);

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^Activity\s+Settlement/i.test(trimmed)) {
      continue;
    }

    const header = trimmed.match(ACCOUNT_HEADER_RE);
    if (header?.[1]) {
      currentAccount = normalizeEtradeAccountId(header[1]);
      ensureBucket(byAccount, currentAccount);
    }

    const bucket = (): ParsedInvestmentTransaction[] => {
      ensureBucket(byAccount, currentAccount);
      return byAccount.get(currentAccount)!;
    };

    const trade = trimmed.match(tradeRe);
    if (trade) {
      const date = dateFromMd(trade[2] ?? trade[1]!, year);
      if (!date) {
        continue;
      }
      const action = trade[3]!;
      const type = mapEtradeAction(action);
      if (!type || type === "fee") {
        continue;
      }

      const desc = trade[4]!.replace(/\s+/g, " ").trim();
      const qty = parseMoney(trade[5]!);
      const price = parseMoney(trade[6]!);
      const amount = parsePdfMoney(trade[7]!);
      const ticker = extractTicker(desc);

      bucket().push({
        externalId: externalId(currentAccount, [date, action, desc, qty, price, amount]),
        date,
        name: `${action} ${desc}`.trim(),
        type,
        ticker,
        securityName: desc,
        quantity: qty,
        price,
        amount:
          type === "buy"
            ? (-Math.abs(Number.parseFloat(amount))).toFixed(2)
            : Math.abs(Number.parseFloat(amount)).toFixed(2),
        fees: "0.00",
      });
      continue;
    }

    const xfer = trimmed.match(transferRe);
    if (xfer) {
      const date = dateFromMd(xfer[2] ?? xfer[1]!, year);
      if (!date) {
        continue;
      }
      const action = xfer[3]!;
      const type = mapEtradeAction(action);
      if (!type) {
        continue;
      }
      const desc = xfer[4]!.replace(/\s+/g, " ").trim();
      const amount = parsePdfMoney(xfer[5]!);

      bucket().push({
        externalId: externalId(currentAccount, [date, action, desc, amount]),
        date,
        name: `${action} ${desc}`.trim(),
        type,
        amount,
        fees: "0.00",
      });
      continue;
    }

    const xferIn = trimmed.match(xferInRe);
    if (xferIn) {
      const date = dateFromMd(xferIn[1]!, year);
      if (!date) {
        continue;
      }
      const desc = xferIn[2]!.replace(/\s+/g, " ").trim();
      const qty = parseMoney(xferIn[3]!);
      const amount = parsePdfMoney(xferIn[4]!);

      bucket().push({
        externalId: externalId(currentAccount, [date, "xfer-in", desc, qty, amount]),
        date,
        name: `Transfer in ${desc}`,
        type: "transfer",
        ticker: extractTicker(desc),
        securityName: desc,
        quantity: qty,
        amount,
        fees: "0.00",
      });
    }
  }

  const emptyWarning =
    "No trades or transfers found in this E*TRADE PDF. Confirm the statement includes an ACTIVITY section.";

  if (byAccount.size === 0) {
    return [
      {
        format: "pdf",
        formatVersion: "etrade-statement",
        sourceFilename: filename,
        account: buildInvestmentIdentity(
          INSTITUTION,
          defaultAccount,
          "E*TRADE Brokerage",
        ),
        bankingTransactions: [],
        investmentTransactions: [],
        warnings: [emptyWarning],
      },
    ];
  }

  return [...byAccount.entries()].map(([accountRaw, txns]) => ({
    format: "pdf" as const,
    formatVersion: "etrade-statement",
    sourceFilename: filename,
    account: buildInvestmentIdentity(
      INSTITUTION,
      accountRaw,
      `E*TRADE • ${formatEtradeAccountDisplay(accountRaw)}`,
    ),
    bankingTransactions: [],
    investmentTransactions: txns,
    warnings: txns.length === 0 ? [emptyWarning] : [],
  }));
}

function formatEtradeAccountDisplay(accountRaw: string): string {
  if (/^\d{12}$/.test(accountRaw)) {
    return `${accountRaw.slice(0, 3)}-${accountRaw.slice(3, 9)}-${accountRaw.slice(9, 12)}`;
  }
  return accountRaw;
}

function extractTicker(description: string): string | undefined {
  const callPut = description.match(/\b(CALL|PUT)\s+([A-Z]{1,6})\b/i);
  if (callPut?.[2]) {
    return callPut[2].toUpperCase();
  }
  const words = description.split(/\s+/);
  for (const w of words) {
    if (/^[A-Z]{1,5}$/.test(w) && w.length >= 1) {
      return w;
    }
  }
  return undefined;
}
