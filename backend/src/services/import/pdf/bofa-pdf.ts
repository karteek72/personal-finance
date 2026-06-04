import { createHash } from "node:crypto";
import {
  buildCreditIdentity,
  buildDepositoryIdentity,
} from "../account-key.js";
import {
  categorizeBankingTransaction,
  classifyBankingType,
} from "../banking-classify.js";
import { maskFromAccountId } from "../csv-parse.js";
import type { ParsedBankingTransaction, ParsedStatement } from "../types.js";

const INSTITUTION = "Bank of America";

function externalId(prefix: string, parts: string[]): string {
  const joined = parts.filter(Boolean).join("|");
  const hash = createHash("sha256").update(joined).digest("hex").slice(0, 16);
  return `pdf:bofa:${prefix}:${hash}`;
}

/** Last four digits from BoFA statement header. */
export function extractBofaAccountMask(text: string): string {
  const bang = text.match(/! Account # [\d* ]+(\d{4})\s*!/i);
  if (bang?.[1]) return bang[1];

  const accountHash = text.match(/Account#\s*[\d\s]+(\d{4})\b/i);
  if (accountHash?.[1]) return accountHash[1];

  const acctNum = text.match(/Account\s+number:\s*[\d\s]+(\d{4})\b/i);
  if (acctNum?.[1]) return acctNum[1];

  const loanAcct = text.match(/Account\s*#:\s*[\d-]+(\d{4})\b/i);
  if (loanAcct?.[1]) return loanAcct[1];

  const ending = text.match(/(?:ending in|Account\s+Number)\s*(?:\*+)?(\d{4})/i);
  if (ending?.[1]) return ending[1];

  const acctLine = text.match(/Account\s*#?\s*[\d*Xx\s]{8,}(\d{4})/i);
  if (acctLine?.[1]) return acctLine[1];

  return "0000";
}

function inferStatementEndYear(text: string, filename: string): number {
  const periodMatch = text.match(
    /! Account # [\d ]+ ! ([A-Za-z]+ \d+,? \d{4}) - ([A-Za-z]+ \d+,? \d{4})/,
  );
  if (periodMatch?.[2]) {
    const year = Number.parseInt(periodMatch[2].split(/[\s,]+/).pop()!, 10);
    if (Number.isFinite(year)) return year;
  }

  const rangeMatch = text.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,?\s+\d{4}\s+(?:to|-)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,?\s+(\d{4})/i,
  );
  if (rangeMatch?.[1]) {
    return Number.parseInt(rangeMatch[1], 10);
  }

  const shortRange = text.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,?\s+(\d{4})/i,
  );
  if (shortRange?.[1]) {
    return Number.parseInt(shortRange[1], 10);
  }

  const closing = text.match(/Statement Closing Date\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (closing?.[3]) {
    return Number.parseInt(closing[3], 10);
  }

  const pathYear = filename.match(/(20\d{2})/);
  if (pathYear?.[1]) return Number.parseInt(pathYear[1], 10);

  return new Date().getFullYear();
}

function inferBofaDepositorySubtype(text: string): "checking" | "savings" {
  const head = text.slice(0, 4000).toLowerCase();
  if (/adv plus banking|advantage banking|checking/.test(head)) return "checking";
  if (/savings|money market/.test(head)) return "savings";
  return "checking";
}

function isAmexMisfiledInBofaFolder(text: string): boolean {
  return (
    /American Express/i.test(text) &&
    !/Bank of America/i.test(text.slice(0, 2000))
  );
}

function skipCreditNoise(description: string): boolean {
  return /^INTEREST CHARGED/i.test(description) || /^TOTAL /i.test(description);
}

/**
 * BoFA credit card — current eStmt layout (Transaction / Posting columns).
 */
export function parseBofaCreditCardText(
  text: string,
  filename: string,
): ParsedStatement {
  const warnings: string[] = [];

  if (isAmexMisfiledInBofaFolder(text)) {
    warnings.push(
      "This PDF looks like American Express, not Bank of America.",
    );
    return emptyBofaStatement("bofa-credit-card", filename, "credit", warnings);
  }

  const mask = extractBofaAccountMask(text);
  const endYear = inferStatementEndYear(text, filename);
  const accountIdRaw = mask === "0000" ? `bofa-cc-${hashFilename(filename)}` : mask;

  const modernRe = new RegExp(
    `^(\\d{2}\\/\\d{2})\\s+(\\d{2}\\/\\d{2})\\s+(.+?)\\s+\\d{4}\\s+${mask}\\s+(-?[\\d,]+\\.\\d{2})\\s*$`,
  );
  const legacyBangRe = new RegExp(
    `^(\\d{2}\\/\\d{2})\\s+(\\d{2}\\/\\d{2})\\s+(.+?)\\s+(?:\\d{4}\\s+)?${mask}\\s+(-?[\\d,]+\\.\\d{2})\\s*$`,
  );
  const looseRe =
    /^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/;

  const bankingTransactions: ParsedBankingTransaction[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let m =
      trimmed.match(modernRe) ??
      trimmed.match(legacyBangRe) ??
      (mask !== "0000" ? null : trimmed.match(looseRe));
    if (!m) continue;

    const posting = m[2]!;
    const [mm, dd] = posting.split("/");
    const date = `${endYear}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
    const name = m[3]!.replace(/\s+/g, " ").trim();
    if (skipCreditNoise(name)) continue;

    const raw = Number.parseFloat(m[4]!.replace(/,/g, ""));
    const isPayment = raw < 0;
    const { transactionType, isTransfer } = isPayment
      ? { transactionType: "transfer" as const, isTransfer: true }
      : classifyBankingType(name, "credit", raw);

    const amount = Math.abs(raw).toFixed(2);

    bankingTransactions.push({
      externalId: externalId("cc", [date, name, String(raw)]),
      date,
      name,
      merchantName: name,
      amount,
      transactionType,
      isTransfer: isTransfer || isPayment,
      category:
        isPayment || isTransfer
          ? "Transfers (internal)"
          : categorizeBankingTransaction(name),
    });
  }

  if (bankingTransactions.length === 0) {
    warnings.push(
      "No credit card transactions found. If this is a new statement layout, report the issue.",
    );
  }

  return {
    format: "pdf",
    formatVersion: "bofa-credit-card",
    sourceFilename: filename,
    account: buildCreditIdentity(
      INSTITUTION,
      accountIdRaw,
      mask !== "0000" ? `Bank of America Visa ••${mask}` : "Bank of America Visa",
    ),
    bankingTransactions,
    investmentTransactions: [],
    warnings,
  };
}

/**
 * BoFA checking/savings — Adv Plus Banking eStmt layout.
 */
export function parseBofaDepositoryText(
  text: string,
  filename: string,
): ParsedStatement {
  const warnings: string[] = [];
  const mask = extractBofaAccountMask(text);
  const subtype = inferBofaDepositorySubtype(text);
  const accountIdRaw = mask === "0000" ? `bofa-dep-${hashFilename(filename)}` : mask;

  const activityRe =
    /^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/;
  const checkRe = /^(\d{2}\/\d{2}\/\d{2})\s+(\d{3,})\s+(-?[\d,]+\.\d{2})\s*$/;

  const bankingTransactions: ParsedBankingTransaction[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const checkMatch = trimmed.match(checkRe);
    if (checkMatch) {
      const [mm, dd, yy] = checkMatch[1]!.split("/");
      const date = `20${yy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
      const checkNum = checkMatch[2]!;
      const raw = Number.parseFloat(checkMatch[3]!.replace(/,/g, ""));
      const amount = Math.abs(raw).toFixed(2);
      bankingTransactions.push({
        externalId: externalId("chk", [date, checkNum, String(raw)]),
        date,
        name: `Check #${checkNum}`,
        merchantName: `Check #${checkNum}`,
        amount,
        transactionType: "expense",
        isTransfer: false,
        category: categorizeBankingTransaction("Check"),
      });
      continue;
    }

    const m = trimmed.match(activityRe);
    if (!m) continue;
    if (/^Total /i.test(m[2]!)) continue;

    const [mm, dd, yy] = m[1]!.split("/");
    const date = `20${yy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
    const name = m[2]!.replace(/\s+/g, " ").trim();
    const raw = Number.parseFloat(m[3]!.replace(/,/g, ""));

    const { transactionType, isTransfer } = classifyBankingType(
      name,
      "depository",
      raw,
    );

    let amount: string;
    if (isTransfer) {
      amount = Math.abs(raw).toFixed(2);
    } else if (transactionType === "income") {
      amount = (-Math.abs(raw)).toFixed(2);
    } else {
      amount = Math.abs(raw).toFixed(2);
    }

    bankingTransactions.push({
      externalId: externalId("dep", [date, name, String(raw)]),
      date,
      name,
      merchantName: name,
      amount,
      transactionType,
      isTransfer,
      category:
        transactionType === "income"
          ? "Income"
          : isTransfer
            ? "Transfers (internal)"
            : categorizeBankingTransaction(name),
    });
  }

  if (bankingTransactions.length === 0) {
    warnings.push("No checking/savings transactions found in this PDF.");
  }

  const label =
    subtype === "savings"
      ? `Bank of America Savings ••${maskFromAccountId(accountIdRaw)}`
      : `Bank of America Checking ••${maskFromAccountId(accountIdRaw)}`;

  return {
    format: "pdf",
    formatVersion: subtype === "savings" ? "bofa-savings" : "bofa-checking",
    sourceFilename: filename,
    account: buildDepositoryIdentity(INSTITUTION, accountIdRaw, subtype, label),
    bankingTransactions,
    investmentTransactions: [],
    warnings,
  };
}

/**
 * BoFA auto loan statement — payment / balance activity.
 */
export function parseBofaAutoLoanText(
  text: string,
  filename: string,
): ParsedStatement {
  const warnings: string[] = [];
  const mask = extractBofaAccountMask(text);
  const accountIdRaw = mask === "0000" ? `bofa-auto-${hashFilename(filename)}` : mask;

  const vehicleMatch = text.match(/(\d{4}\s+[A-Z][A-Z\s]+)/);
  const vehicle = vehicleMatch?.[1]?.trim() ?? "Auto Loan";

  const lineRe =
    /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/;
  const bankingTransactions: ParsedBankingTransaction[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(lineRe);
    if (!m) continue;

    const dateParts = m[1]!.split("/");
    const mm = dateParts[0]!.padStart(2, "0");
    const dd = dateParts[1]!.padStart(2, "0");
    let yyyy = dateParts[2]!;
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    const date = `${yyyy}-${mm}-${dd}`;

    const name = m[2]!.replace(/\s+/g, " ").trim();
    if (/^Beginning|^Ending|^Total/i.test(name)) continue;

    const raw = Number.parseFloat(m[3]!.replace(/,/g, ""));
    const amount = Math.abs(raw).toFixed(2);

    bankingTransactions.push({
      externalId: externalId("auto", [date, name, String(raw)]),
      date,
      name,
      merchantName: name,
      amount,
      transactionType: /payment/i.test(name) ? "expense" : "transfer",
      isTransfer: /payment/i.test(name),
      category: categorizeBankingTransaction(name),
    });
  }

  if (bankingTransactions.length === 0) {
    warnings.push(
      "No loan payment lines found. Auto loan PDFs may only show balances — payments may appear on your checking statement.",
    );
  }

  return {
    format: "pdf",
    formatVersion: "bofa-auto-loan",
    sourceFilename: filename,
    account: buildCreditIdentity(
      INSTITUTION,
      accountIdRaw,
      `BoFA Auto Loan ••${mask} (${vehicle})`,
    ),
    bankingTransactions,
    investmentTransactions: [],
    warnings,
  };
}

function hashFilename(filename: string): string {
  return createHash("sha256").update(filename).digest("hex").slice(0, 8);
}

function emptyBofaStatement(
  formatVersion: string,
  filename: string,
  kind: "credit" | "depository",
  warnings: string[],
): ParsedStatement {
  const accountIdRaw = hashFilename(filename);
  return {
    format: "pdf",
    formatVersion,
    sourceFilename: filename,
    account:
      kind === "credit"
        ? buildCreditIdentity(INSTITUTION, accountIdRaw, "Bank of America")
        : buildDepositoryIdentity(INSTITUTION, accountIdRaw, "checking"),
    bankingTransactions: [],
    investmentTransactions: [],
    warnings,
  };
}
