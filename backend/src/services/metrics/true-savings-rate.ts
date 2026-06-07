import { buildMetricEnvelope, type MetricEnvelope } from "./types.js";
import { computeSavingsRate } from "./savings-rate.js";
import { netExpenseAfterRefunds } from "../refund-netting.js";

/**
 * True savings rate: (income − net spend − linked investments) / income.
 * Net spend excludes transfer legs and refund pairs.
 */
export function computeTrueSavingsRate(input: {
  income: number;
  grossExpense: number;
  nettedRefunds: number;
  linkedInvestments: number;
}): number {
  const netExpense = netExpenseAfterRefunds(
    input.grossExpense,
    input.nettedRefunds,
  );
  return computeSavingsRate({
    income: input.income,
    expense: netExpense + input.linkedInvestments,
  });
}

export function trueSavingsRateMetric(input: {
  income: number;
  grossExpense: number;
  nettedRefunds: number;
  linkedInvestments: number;
  asOf: string;
  confidence?: number;
  caveats?: string[];
}): MetricEnvelope {
  return buildMetricEnvelope({
    value: computeTrueSavingsRate(input),
    unit: "percent",
    asOf: input.asOf,
    class: "diagnostic",
    basis: "factual",
    confidence: input.confidence ?? 0.8,
    caveats: input.caveats,
  });
}
