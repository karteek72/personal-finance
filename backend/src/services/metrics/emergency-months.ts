import { roundDecimal } from "../../lib/money.js";
import { buildMetricEnvelope, type MetricEnvelope } from "./types.js";

/**
 * Emergency-fund months of coverage.
 * Definition: liquid_reserves / trailing3mo_essential_burn.
 */
export function computeEmergencyMonths(input: {
  liquidReserves: number;
  essentialBurnRate: number;
}): number {
  const { liquidReserves, essentialBurnRate } = input;
  if (essentialBurnRate <= 0) {
    return 0;
  }
  return roundDecimal(liquidReserves / essentialBurnRate);
}

export interface EmergencyMonthsMetricInput {
  liquidReserves: number;
  essentialBurnRate: number;
  asOf: string;
  confidence?: number;
  caveats?: string[];
}

/** Emergency-fund months wrapped in the metric envelope. */
export function emergencyMonthsMetric(
  input: EmergencyMonthsMetricInput,
): MetricEnvelope {
  const months = computeEmergencyMonths({
    liquidReserves: input.liquidReserves,
    essentialBurnRate: input.essentialBurnRate,
  });
  const caveats = [...(input.caveats ?? [])];
  if (input.essentialBurnRate <= 0) {
    caveats.push("Essential burn is zero; months of coverage undefined");
  }

  return buildMetricEnvelope({
    value: months,
    unit: "months",
    asOf: input.asOf,
    class: "diagnostic",
    basis: "factual",
    confidence: input.confidence ?? (input.essentialBurnRate > 0 ? 0.9 : 0.3),
    caveats: caveats.length > 0 ? caveats : undefined,
  });
}
