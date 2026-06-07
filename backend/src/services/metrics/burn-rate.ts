import { roundDecimal } from "../../lib/money.js";
import { buildMetricEnvelope, type MetricEnvelope } from "./types.js";

/**
 * Trailing essential burn rate (USD/month).
 * Definition: average monthly essential outflow over the lookback window.
 */
export function computeBurnRate(input: {
  essentialOutflowTotal: number;
  months: number;
}): number {
  const { essentialOutflowTotal, months } = input;
  if (months <= 0 || essentialOutflowTotal <= 0) {
    return 0;
  }
  return roundDecimal(essentialOutflowTotal / months);
}

export interface BurnRateMetricInput {
  essentialOutflowTotal: number;
  months: number;
  asOf: string;
  confidence?: number;
  caveats?: string[];
}

/** Essential burn rate wrapped in the metric envelope. */
export function burnRateMetric(input: BurnRateMetricInput): MetricEnvelope {
  const rate = computeBurnRate({
    essentialOutflowTotal: input.essentialOutflowTotal,
    months: input.months,
  });
  const caveats = [...(input.caveats ?? [])];
  if (input.months < 3) {
    caveats.push(
      `Only ${input.months} month(s) of essential spend; trailing-3mo burn is approximate`,
    );
  }
  if (rate <= 0) {
    caveats.push("No essential outflow in lookback window");
  }

  return buildMetricEnvelope({
    value: rate,
    unit: "USD",
    asOf: input.asOf,
    class: "diagnostic",
    basis: "heuristic",
    confidence: input.confidence ?? (input.months >= 3 ? 0.9 : 0.6),
    caveats: caveats.length > 0 ? caveats : undefined,
  });
}
