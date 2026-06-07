import { formatMoneyAmount, roundDecimal, roundPercent } from "../../lib/money.js";

export type MetricUnit = "USD" | "percent" | "months" | "ratio" | "score";
export type MetricClass =
  | "descriptive"
  | "diagnostic"
  | "predictive"
  | "prescriptive";
export type MetricBasis = "factual" | "heuristic" | "external";
export type TrendDirection = "up" | "down" | "flat";

export interface MetricTrend {
  delta: string;
  deltaPct: number;
  direction: TrendDirection;
  comparison: string;
}

export interface MetricEnvelope {
  value: string;
  unit: MetricUnit;
  grain: string;
  asOf: string;
  class: MetricClass;
  basis: MetricBasis;
  confidence: number;
  trend?: MetricTrend;
  caveats?: string[];
}

export interface MetricEnvelopeInput {
  value: number;
  unit: MetricUnit;
  grain?: string;
  asOf: string;
  class: MetricClass;
  basis: MetricBasis;
  confidence?: number;
  trend?: MetricTrend;
  caveats?: string[];
}

function formatMetricValue(value: number, unit: MetricUnit): string {
  switch (unit) {
    case "USD":
      return formatMoneyAmount(value);
    case "percent":
      return String(roundDecimal(value, 4));
    case "months":
    case "ratio":
    case "score":
      return String(roundDecimal(value, 2));
    default: {
      const _exhaustive: never = unit;
      return String(_exhaustive);
    }
  }
}

/** Build a metric envelope from a numeric value. */
export function buildMetricEnvelope(input: MetricEnvelopeInput): MetricEnvelope {
  const envelope: MetricEnvelope = {
    value: formatMetricValue(input.value, input.unit),
    unit: input.unit,
    grain: input.grain ?? "monthly",
    asOf: input.asOf,
    class: input.class,
    basis: input.basis,
    confidence: roundDecimal(input.confidence ?? 1, 2),
  };
  if (input.trend) {
    envelope.trend = input.trend;
  }
  if (input.caveats && input.caveats.length > 0) {
    envelope.caveats = input.caveats;
  }
  return envelope;
}

/** Parse the numeric value from a metric envelope. */
export function metricNumericValue(envelope: MetricEnvelope): number {
  return Number.parseFloat(envelope.value);
}

export function buildPercentTrend(
  current: number,
  prior: number,
  comparison: string,
): MetricTrend | undefined {
  if (!Number.isFinite(prior) || prior === 0) {
    return undefined;
  }
  const delta = current - prior;
  const deltaPct = roundPercent((delta / prior) * 100);
  const direction: TrendDirection =
    delta > 0.000_1 ? "up" : delta < -0.000_1 ? "down" : "flat";
  return {
    delta: String(roundDecimal(delta, 4)),
    deltaPct,
    direction,
    comparison,
  };
}
