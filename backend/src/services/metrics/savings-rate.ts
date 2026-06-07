import { roundDecimal } from "../../lib/money.js";
import { buildMetricEnvelope, type MetricEnvelope } from "./types.js";

/**
 * Savings rate as a 0–1 fraction (`unit: "percent"` — multiply by 100 once in UI).
 * Definition: (income − expense) / income; expense excludes transfers and internal transfers.
 */
export function computeSavingsRate(input: {
  income: number;
  expense: number;
}): number {
  const { income, expense } = input;
  if (income <= 0) {
    return 0;
  }
  return roundDecimal((income - expense) / income);
}

export interface SavingsRateMetricInput {
  income: number;
  expense: number;
  asOf: string;
  priorRate?: number;
  confidence?: number;
  caveats?: string[];
}

/** Savings rate wrapped in the metric envelope. */
export function savingsRateMetric(input: SavingsRateMetricInput): MetricEnvelope {
  const rate = computeSavingsRate({
    income: input.income,
    expense: input.expense,
  });
  const caveats = [...(input.caveats ?? [])];
  if (input.income <= 0) {
    caveats.push("No income in period; savings rate set to 0");
  }

  return buildMetricEnvelope({
    value: rate,
    unit: "percent",
    asOf: input.asOf,
    class: "diagnostic",
    basis: "factual",
    confidence: input.confidence ?? (input.income > 0 ? 1 : 0.5),
    trend:
      input.priorRate !== undefined
        ? {
            delta: String(roundDecimal(rate - input.priorRate, 4)),
            deltaPct: roundDecimal(
              input.priorRate !== 0
                ? ((rate - input.priorRate) / Math.abs(input.priorRate)) * 100
                : 0,
              2,
            ),
            direction:
              rate > input.priorRate + 0.000_1
                ? "up"
                : rate < input.priorRate - 0.000_1
                  ? "down"
                  : "flat",
            comparison: "vs prior period",
          }
        : undefined,
    caveats: caveats.length > 0 ? caveats : undefined,
  });
}
