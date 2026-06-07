import { parseDateUs, parseMoney, parseSignedMoney } from "../csv-parse.js";

/** Infer calendar year from statement header or filename. */
export function inferStatementYear(text: string, filename: string): number {
  const periodEnd = text.match(
    /(?:For the Period|Statement Period:)\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4}\s*-\s*(?:[A-Za-z]+\s+\d{1,2},?\s+)?(\d{4})/i,
  );
  if (periodEnd?.[1]) {
    return Number.parseInt(periodEnd[1], 10);
  }

  const yearEnd = text.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(\d{4})/i,
  );
  if (yearEnd?.[1]) {
    return Number.parseInt(yearEnd[1], 10);
  }

  const stmtDate = text.match(/Statement date:\s*\d{1,2}\/\d{1,2}\/(\d{4})/i);
  if (stmtDate?.[1]) {
    return Number.parseInt(stmtDate[1], 10);
  }

  const pathYear = filename.match(/(20\d{2})/);
  if (pathYear?.[1]) {
    return Number.parseInt(pathYear[1], 10);
  }

  return new Date().getFullYear();
}

/** MM/DD with inferred year → YYYY-MM-DD */
export function dateFromMd(raw: string, year: number): string | null {
  const parts = raw.trim().split("/");
  if (parts.length !== 2) {
    return null;
  }
  const mm = parts[0]!.padStart(2, "0");
  const dd = parts[1]!.padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parsePdfMoney(raw: string): string {
  const t = raw.replace(/\$/g, "").trim();
  const paren = /^\((.+)\)$/.test(t);
  const cleaned = t.replace(/[(),]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) {
    return "0.00";
  }
  const signed = paren ? -Math.abs(n) : n;
  return signed.toFixed(2);
}

export function parsePdfDateLoose(raw: string): string | null {
  const iso = parseDateUs(raw);
  if (iso) {
    return iso;
  }
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    return parseDateUs(slash[0]!);
  }
  return null;
}

export function signedTradeAmount(
  action: string,
  amountRaw: string,
): string {
  const n = Number.parseFloat(parsePdfMoney(amountRaw));
  const a = action.toUpperCase();
  if (a === "BOUGHT" || a === "BUY" || a === "BOUGHT TO COVER") {
    return n <= 0 ? n.toFixed(2) : (-Math.abs(n)).toFixed(2);
  }
  if (a === "SOLD" || a === "SELL" || a === "SOLD SHORT") {
    return n >= 0 ? Math.abs(n).toFixed(2) : n.toFixed(2);
  }
  return parseSignedMoney(amountRaw.replace(/[()]/g, (m) => (m === "(" ? "-" : "")));
}
