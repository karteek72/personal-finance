import {
  parseCoinbaseTxHistoryCsv,
  parseEtradeTransactionsCsv,
  parseFidelityActivityCsv,
  parseRobinhoodActivityCsv,
  parseSchwabTransactionsCsv,
  parseSoFiCheckingCsv,
  parseWebullOrdersCsv,
} from "./csv-templates.js";
import { headerIndexMap, normalizeHeader, parseCsvRows } from "./csv-parse.js";
import {
  detectIssuerCsv,
  parseIssuerCsv,
  rejectFidelityStatementCsv,
} from "./issuer-csv.js";
import type { ParsedStatement } from "./types.js";

export type CsvTemplateId =
  | "fidelity-activity"
  | "etrade-transactions"
  | "webull-orders"
  | "schwab-transactions"
  | "robinhood-activity"
  | "coinbase-tx-history"
  | "sofi-checking";

interface TemplateDetector {
  id: CsvTemplateId;
  requiredHeaders: string[];
  parse: (content: string, filename: string) => ParsedStatement;
}

const TEMPLATES: TemplateDetector[] = [
  {
    id: "coinbase-tx-history",
    requiredHeaders: ["timestamp", "transaction type", "asset"],
    parse: parseCoinbaseTxHistoryCsv,
  },
  {
    id: "sofi-checking",
    requiredHeaders: ["date", "description", "type", "amount", "balance"],
    parse: parseSoFiCheckingCsv,
  },
  {
    id: "robinhood-activity",
    requiredHeaders: ["activity date", "instrument", "trans code"],
    parse: parseRobinhoodActivityCsv,
  },
  {
    id: "schwab-transactions",
    requiredHeaders: ["date", "action", "symbol", "quantity", "price"],
    parse: parseSchwabTransactionsCsv,
  },
  {
    id: "fidelity-activity",
    requiredHeaders: ["run date", "action", "symbol", "quantity", "price"],
    parse: parseFidelityActivityCsv,
  },
  {
    id: "etrade-transactions",
    requiredHeaders: ["transactiondate", "symbol"],
    parse: parseEtradeTransactionsCsv,
  },
  {
    id: "webull-orders",
    requiredHeaders: ["symbol", "side", "status"],
    parse: parseWebullOrdersCsv,
  },
];

function headerSetFromRows(rows: string[][]): Set<string> {
  for (const row of rows) {
    const set = new Set(row.map((h) => normalizeHeader(h)));
    if (set.size >= 3) {
      return set;
    }
  }
  return new Set();
}

function aliases(header: string): string[] {
  if (header === "transactiondate") {
    return ["transactiondate", "transaction date"];
  }
  return [header];
}

export function detectCsvTemplate(content: string): CsvTemplateId | null {
  const rows = parseCsvRows(content);
  const headers = headerSetFromRows(rows);

  for (const template of TEMPLATES) {
    const ok = template.requiredHeaders.every((req) =>
      aliases(req).some((a) => headers.has(a)),
    );
    if (ok) {
      return template.id;
    }
  }

  return null;
}

export function parseCsvStatement(
  content: string,
  filename: string,
): ParsedStatement {
  const issuerId = detectIssuerCsv(content, filename);
  if (issuerId) {
    return parseIssuerCsv(issuerId, content, filename);
  }

  const rows = parseCsvRows(content);
  const flat = rows
    .slice(0, 12)
    .flat()
    .join(" ")
    .toLowerCase();
  if (flat.includes("beginning mkt value") || flat.includes("symbol/cusip")) {
    rejectFidelityStatementCsv(content, filename);
  }

  const templateId = detectCsvTemplate(content);
  if (!templateId) {
    throw new Error(
      `Unsupported CSV format in "${filename}". ` +
        "Supported: Amex, Discover, Citi card, Fidelity activity, E*TRADE, Webull, Schwab, Robinhood, Coinbase, SoFi.",
    );
  }

  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  return template.parse(content, filename);
}
