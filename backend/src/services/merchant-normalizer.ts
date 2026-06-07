const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

const PROCESSOR_PREFIX =
  /^(?:SQ\s*\*|TST\*?\s*|SP\s*\*|PAYPAL\s*\*|PP\s*\*|AMZN\s*\*|GOOGLE\s*\*|INT\s*\*|CHECKCARD\s+)\s*/i;

const STORE_NUMBER = /\s#\d{3,5}\b/g;
const STORE_LABEL = /\b(?:STORE|STO)\s*#?\d+\b/gi;
const TRAILING_STORE_ID = /\s+\d{4,6}$/;
const TRAILING_ZIP = /\s+\d{5}(?:-\d{4})?$/;

export interface NormalizedMerchant {
  canonicalKey: string;
  displayName: string;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTrailingLocation(value: string): string {
  let current = value.replace(TRAILING_ZIP, "").trimEnd();
  const parts = current.split(/\s+/);
  if (parts.length < 3) {
    return current;
  }

  const state = parts[parts.length - 1]?.toUpperCase();
  if (!state || !US_STATE_CODES.has(state)) {
    return current;
  }

  for (const cityWords of [2, 1] as const) {
    if (parts.length <= cityWords + 1) {
      continue;
    }
    const candidate = parts.slice(0, -(cityWords + 1)).join(" ");
    if (candidate.length > 0) {
      return candidate;
    }
  }

  return current;
}

function toDisplayName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bMcd\b/g, "McD")
    .replace(/\bId\b/g, "ID");
}

/**
 * Normalize raw merchant strings into a stable canonical key for dim_merchant.
 * Strips processor prefixes (SQ *, TST*), store numbers, trailing digits, and
 * common trailing city/state/zip patterns.
 */
export function normalizeMerchant(
  merchantName: string | null | undefined,
  name: string,
): NormalizedMerchant | null {
  const raw = collapseWhitespace(merchantName?.trim() || name.trim());
  if (!raw) {
    return null;
  }

  let cleaned = raw.replace(PROCESSOR_PREFIX, "");
  cleaned = cleaned.replace(STORE_LABEL, " ");
  cleaned = cleaned.replace(STORE_NUMBER, " ");
  cleaned = cleaned.replace(TRAILING_STORE_ID, "");
  cleaned = stripTrailingLocation(cleaned);
  cleaned = collapseWhitespace(cleaned.replace(/\*/g, " "));

  if (!cleaned) {
    return null;
  }

  const canonicalKey = cleaned.toLowerCase();
  return {
    canonicalKey,
    displayName: toDisplayName(cleaned),
  };
}
