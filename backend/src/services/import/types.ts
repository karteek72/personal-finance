export type AccountSubtype =
  | "checking"
  | "savings"
  | "cash"
  | "money_market"
  | "credit_card"
  | "brokerage"
  | "401k"
  | "ira"
  | "roth_ira"
  | "hsa"
  | "crypto";

export type InvestmentTxnType =
  | "buy"
  | "sell"
  | "buy_to_cover"
  | "sell_short"
  | "dividend"
  | "interest"
  | "contribution"
  | "withdrawal"
  | "transfer"
  | "fee";

export interface ParsedAccountIdentity {
  institutionName: string;
  accountIdRaw: string;
  mask: string;
  type: "depository" | "credit" | "investment";
  subtype: AccountSubtype;
  officialName?: string;
  currencyCode: string;
  importAccountKey: string;
}

export interface ParsedInvestmentTransaction {
  externalId: string;
  date: string;
  name: string;
  type: InvestmentTxnType;
  ticker?: string;
  securityName?: string;
  assetType?: "equity" | "etf" | "crypto";
  quantity?: string;
  price?: string;
  amount: string;
  fees: string;
}

export interface ParsedBankingTransaction {
  externalId: string;
  date: string;
  name: string;
  merchantName: string;
  amount: string;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  category: string;
  /** Set after classification (preview + persist). */
  subCategory?: string | null;
}

export interface ParsedStatement {
  format: "csv" | "qfx" | "ofx" | "pdf";
  formatVersion: string;
  sourceFilename: string;
  account: ParsedAccountIdentity;
  bankingTransactions: ParsedBankingTransaction[];
  investmentTransactions: ParsedInvestmentTransaction[];
  warnings: string[];
}

/** Stored in import_files.parsed_preview after parse-only pass */
export interface ImportFilePreviewPayload {
  statements: ParsedStatement[];
  matchedAccountIds: (string | null)[];
}
