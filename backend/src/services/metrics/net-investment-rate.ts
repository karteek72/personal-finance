import { buildMetricEnvelope, type MetricEnvelope } from "./types.js";

/** Net contributions / income (0–1 fraction). Uses transfer_links for brokerage ACH. */
export function computeNetInvestmentRate(input: {
  linkedContributions: number;
  income: number;
}): number {
  if (input.income <= 0) return 0;
  return Math.max(0, input.linkedContributions / input.income);
}

export function netInvestmentRateMetric(input: {
  linkedContributions: number;
  income: number;
  asOf: string;
  confidence?: number;
  caveats?: string[];
}): MetricEnvelope {
  return buildMetricEnvelope({
    value: computeNetInvestmentRate(input),
    unit: "percent",
    asOf: input.asOf,
    class: "diagnostic",
    basis: "factual",
    confidence: input.confidence ?? 0.85,
    caveats: input.caveats,
  });
}
