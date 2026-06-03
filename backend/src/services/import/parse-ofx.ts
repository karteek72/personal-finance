import { buildImportAccountKey } from "./account-key.js";
import {
  categorizeBankingTransaction,
  classifyBankingType,
} from "./banking-classify.js";
import type {
  AccountSubtype,
  InvestmentTxnType,
  ParsedAccountIdentity,
  ParsedBankingTransaction,
  ParsedInvestmentTransaction,
  ParsedStatement,
} from "./types.js";

function tagValue(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([^<\\n]+)`));
  return m?.[1]?.trim() ?? "";
}

function parseOfxDate(raw: string): string {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    throw new Error(`Invalid OFX date: ${raw}`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function maskFromAccountId(acctId: string): string {
  const digits = acctId.replace(/\D/g, "");
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  return acctId.slice(-4).padStart(4, "*");
}

function mapBankSubtype(acctType: string): AccountSubtype {
  const t = acctType.toUpperCase();
  if (t.includes("SAV")) return "savings";
  if (t.includes("MONEY")) return "money_market";
  if (t.includes("CHECK")) return "checking";
  return "checking";
}

function mapInvestmentSubtype(acctType: string): AccountSubtype {
  const t = acctType.toUpperCase();
  if (t.includes("401")) return "401k";
  if (t.includes("ROTH")) return "roth_ira";
  if (t.includes("IRA")) return "ira";
  return "brokerage";
}

function inferInstitution(content: string, filename: string): string {
  const org = tagValue(content, "ORG");
  if (org) return org;
  const fi = tagValue(content, "FI");
  if (fi) return fi;

  const lower = filename.toLowerCase();
  if (lower.includes("fidelity")) return "Fidelity";
  if (lower.includes("etrade") || lower.includes("e-trade")) return "E*TRADE";
  if (lower.includes("schwab")) return "Charles Schwab";
  if (lower.includes("bofa") || lower.includes("bankofamerica")) {
    return "Bank of America";
  }
  if (lower.includes("chase")) return "Chase";
  if (lower.includes("amex")) return "American Express";
  return "Imported institution";
}

function mapInvestmentTrnType(trnType: string): InvestmentTxnType {
  const t = trnType.toUpperCase();
  if (t === "BUY") return "buy";
  if (t === "SELL") return "sell";
  if (t === "INCOME" || t === "DIV") return "dividend";
  if (t === "INT") return "interest";
  if (t === "FEE") return "fee";
  if (t === "REINVEST") return "buy";
  if (t === "TRANSFER") return "transfer";
  return "transfer";
}

function parseBankStmtBlock(
  block: string,
  format: "qfx" | "ofx",
  institutionName: string,
  filename: string,
): ParsedStatement {
  const isCredit = /<CCACCTFROM>/i.test(block);
  const acctId = tagValue(block, "ACCTID");
  const acctType =
    tagValue(block, "ACCTTYPE") || (isCredit ? "CREDITCARD" : "CHECKING");
  const mask = maskFromAccountId(acctId);
  const type = isCredit ? ("credit" as const) : ("depository" as const);
  const subtype = isCredit ? ("credit_card" as const) : mapBankSubtype(acctType);

  const account: ParsedAccountIdentity = {
    institutionName,
    accountIdRaw: acctId,
    mask,
    type,
    subtype,
    officialName: `${institutionName} ••${mask}`,
    currencyCode: tagValue(block, "CURDEF") || "USD",
    importAccountKey: buildImportAccountKey(institutionName, acctId, type),
  };

  const txnBlocks = block.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const bankingTransactions: ParsedBankingTransaction[] = [];

  for (const txnBlock of txnBlocks) {
    const fitId = tagValue(txnBlock, "FITID");
    const trnType = tagValue(txnBlock, "TRNTYPE");
    const rawAmt = Number.parseFloat(tagValue(txnBlock, "TRNAMT") || "0");
    const name =
      tagValue(txnBlock, "NAME") || tagValue(txnBlock, "MEMO") || "Unknown";
    const dateRaw = tagValue(txnBlock, "DTPOSTED");
    if (!dateRaw) continue;

    const date = parseOfxDate(dateRaw);
    let amount: string;
    if (trnType === "CREDIT" || rawAmt > 0) {
      amount = (-Math.abs(rawAmt)).toFixed(2);
    } else {
      amount = Math.abs(rawAmt).toFixed(2);
    }

    const { transactionType, isTransfer } = classifyBankingType(
      name,
      type,
      rawAmt,
    );
    if (isTransfer) {
      amount = Math.abs(Number.parseFloat(amount)).toFixed(2);
    }

    bankingTransactions.push({
      externalId: fitId ? `ofx:${fitId}` : `ofx:${date}:${name}:${rawAmt}`,
      date,
      name,
      merchantName: name,
      amount,
      transactionType,
      isTransfer,
      category: isTransfer ? "Transfers (internal)" : categorizeBankingTransaction(name),
    });
  }

  return {
    format,
    formatVersion: isCredit ? "ofx-credit" : "ofx-bank",
    sourceFilename: filename,
    account,
    bankingTransactions,
    investmentTransactions: [],
    warnings: [],
  };
}

function parseInvestmentStmtBlock(
  block: string,
  format: "qfx" | "ofx",
  institutionName: string,
  filename: string,
): ParsedStatement {
  const acctId = tagValue(block, "ACCTID");
  const acctType = tagValue(block, "ACCTTYPE") || "BROKERAGE";
  const mask = maskFromAccountId(acctId);

  const account: ParsedAccountIdentity = {
    institutionName,
    accountIdRaw: acctId,
    mask,
    type: "investment",
    subtype: mapInvestmentSubtype(acctType),
    officialName: `${institutionName} ••${mask}`,
    currencyCode: tagValue(block, "CURDEF") || "USD",
    importAccountKey: buildImportAccountKey(institutionName, acctId, "investment"),
  };

  const txnBlocks = block.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const investmentTransactions: ParsedInvestmentTransaction[] = [];

  for (const txnBlock of txnBlocks) {
    const fitId = tagValue(txnBlock, "FITID");
    const trnType = tagValue(txnBlock, "TRNTYPE");
    const dateRaw = tagValue(txnBlock, "DTPOSTED");
    if (!dateRaw) continue;

    const date = parseOfxDate(dateRaw);
    const ticker =
      tagValue(txnBlock, "TICKER") ||
      tagValue(txnBlock, "SYMBOL") ||
      undefined;
    const units = tagValue(txnBlock, "UNITS") || tagValue(txnBlock, "SHARES");
    const unitPrice = tagValue(txnBlock, "UNITPRICE") || tagValue(txnBlock, "PRICE");
    const rawAmt = Number.parseFloat(tagValue(txnBlock, "TRNAMT") || "0");
    const name =
      tagValue(txnBlock, "NAME") ||
      tagValue(txnBlock, "MEMO") ||
      (ticker ? `${trnType} ${ticker}` : trnType) ||
      "Investment transaction";

    const type = mapInvestmentTrnType(trnType);
    const amount = Math.abs(rawAmt).toFixed(2);
    const fees = tagValue(txnBlock, "COMMISSION") || "0";

    investmentTransactions.push({
      externalId: fitId ? `ofx:${fitId}` : `ofx:${date}:${ticker ?? name}:${rawAmt}`,
      date,
      name,
      type,
      ticker,
      securityName: tagValue(txnBlock, "SECNAME") || ticker,
      quantity: units || undefined,
      price: unitPrice || undefined,
      amount,
      fees,
    });
  }

  return {
    format,
    formatVersion: "ofx-investment",
    sourceFilename: filename,
    account,
    bankingTransactions: [],
    investmentTransactions,
    warnings: [],
  };
}

export function parseOfxFile(
  content: string,
  filename: string,
): ParsedStatement[] {
  const format: "qfx" | "ofx" = filename.toLowerCase().endsWith(".qfx")
    ? "qfx"
    : "ofx";
  const institutionName = inferInstitution(content, filename);
  const results: ParsedStatement[] = [];

  const bankBlocks = content.match(/<STMTRS>[\s\S]*?<\/STMTRS>/gi) ?? [];
  for (const block of bankBlocks) {
    results.push(parseBankStmtBlock(block, format, institutionName, filename));
  }

  const invBlocks = content.match(/<INVSTMTRS>[\s\S]*?<\/INVSTMTRS>/gi) ?? [];
  for (const block of invBlocks) {
    results.push(
      parseInvestmentStmtBlock(block, format, institutionName, filename),
    );
  }

  if (results.length === 0) {
    const orphanTxns = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
    if (orphanTxns.length > 0) {
      const synthetic = `<STMTRS>${orphanTxns.join("")}</STMTRS>`;
      results.push(
        parseBankStmtBlock(synthetic, format, institutionName, filename),
      );
    }
  }

  if (results.length === 0) {
    throw new Error(
      "No account statements found in OFX/QFX file. Export from your bank or broker in QFX/OFX format.",
    );
  }

  return results;
}
