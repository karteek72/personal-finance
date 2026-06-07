import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { fireProfiles } from "../db/schema.js";
import { roundDecimal } from "../lib/money.js";

/** Detected income below this monthly amount is treated as unreliable. */
const MIN_RELIABLE_DETECTED_MONTHLY = 500;

/** Relative gap that triggers a stated-vs-detected discrepancy caveat. */
const DISCREPANCY_THRESHOLD = 0.25;

export type IncomeSource = "detected" | "stated" | "detected_with_caveat";

export interface EffectiveMonthlyIncome {
  monthlyIncome: number;
  detectedMonthly: number;
  statedMonthly: number | null;
  source: IncomeSource;
  caveats: string[];
}

export async function getStatedMonthlyIncome(
  userId: string,
): Promise<number | null> {
  const db = getDb();
  const [row] = await db
    .select({ annualGrossIncome: fireProfiles.annualGrossIncome })
    .from(fireProfiles)
    .where(eq(fireProfiles.userId, userId))
    .limit(1);

  if (!row?.annualGrossIncome) {
    return null;
  }

  const annual = Number.parseFloat(row.annualGrossIncome);
  if (!Number.isFinite(annual) || annual <= 0) {
    return null;
  }

  return roundDecimal(annual / 12, 2);
}

/**
 * Resolve monthly income for analytics: detected transactions are primary when
 * reliable; stated gross income fills gaps and flags large discrepancies.
 */
export function resolveEffectiveMonthlyIncomeFromValues(
  detectedMonthly: number,
  statedMonthly: number | null,
): EffectiveMonthlyIncome {
  const detected = roundDecimal(Math.max(detectedMonthly, 0), 2);
  const caveats: string[] = [];

  const detectedUnreliable =
    detected < MIN_RELIABLE_DETECTED_MONTHLY &&
    statedMonthly != null &&
    statedMonthly > 0;

  if (detectedUnreliable) {
    caveats.push(
      "Transaction-detected income is low; using your stated annual gross income as the denominator.",
    );
    return {
      monthlyIncome: statedMonthly,
      detectedMonthly: detected,
      statedMonthly,
      source: "stated",
      caveats,
    };
  }

  if (detected <= 0 && statedMonthly != null && statedMonthly > 0) {
    caveats.push(
      "No income transactions detected; using your stated annual gross income.",
    );
    return {
      monthlyIncome: statedMonthly,
      detectedMonthly: detected,
      statedMonthly,
      source: "stated",
      caveats,
    };
  }

  if (
    statedMonthly != null &&
    statedMonthly > 0 &&
    detected > 0 &&
    Math.abs(detected - statedMonthly) / statedMonthly >= DISCREPANCY_THRESHOLD
  ) {
    const pct = roundDecimal(
      (Math.abs(detected - statedMonthly) / statedMonthly) * 100,
      0,
    );
    caveats.push(
      `Detected monthly income ($${detected.toLocaleString()}) differs from stated ($${statedMonthly.toLocaleString()}) by ~${pct}%. Review income categorization or update profile.`,
    );
    return {
      monthlyIncome: detected,
      detectedMonthly: detected,
      statedMonthly,
      source: "detected_with_caveat",
      caveats,
    };
  }

  return {
    monthlyIncome: detected,
    detectedMonthly: detected,
    statedMonthly,
    source: "detected",
    caveats,
  };
}

export async function resolveEffectiveMonthlyIncome(
  userId: string,
  detectedMonthly: number,
): Promise<EffectiveMonthlyIncome> {
  const statedMonthly = await getStatedMonthlyIncome(userId);
  return resolveEffectiveMonthlyIncomeFromValues(detectedMonthly, statedMonthly);
}
