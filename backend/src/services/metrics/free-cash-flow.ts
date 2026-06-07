import { roundDecimal } from "../../lib/money.js";
import { buildMetricEnvelope, type MetricEnvelope } from "./types.js";

/**
 * Free cash flow (USD/month).
 * Definition: income − essential − debt_min − committed_recurring.
 */
export function computeFreeCashFlow(input: {
  income: number;
  essentialOutflow: number;
  debtMin?: number;
  committedRecurring?: number;
}): number {
  const debtMin = input.debtMin ?? 0;
  const committedRecurring = input.committedRecurring ?? 0;
  return roundDecimal(
    input.income - input.essentialOutflow - debtMin - committedRecurring,
  );
}

export interface FreeCashFlowMetricInput {
  income: number;
  essentialOutflow: number;
  debtMin?: number;
  committedRecurring?: number;
  asOf: string;
  confidence?: number;
  caveats?: string[];
}

/** Free cash flow wrapped in the metric envelope. */
export function freeCashFlowMetric(
  input: FreeCashFlowMetricInput,
): MetricEnvelope {
  const debtMin = input.debtMin ?? 0;
  const committedRecurring = input.committedRecurring ?? 0;
  const fcf = computeFreeCashFlow({
    income: input.income,
    essentialOutflow: input.essentialOutflow,
    debtMin,
    committedRecurring,
  });

  const caveats = [...(input.caveats ?? [])];
  if (input.debtMin === undefined) {
    caveats.push("Minimum debt payments not tracked; excluded from FCF");
  }
  if (input.committedRecurring === undefined) {
    caveats.push("Committed recurring charges not tracked; excluded from FCF");
  }

  return buildMetricEnvelope({
    value: fcf,
    unit: "USD",
    asOf: input.asOf,
    class: "diagnostic",
    basis: "heuristic",
    confidence: input.confidence ?? 0.75,
    caveats: caveats.length > 0 ? caveats : undefined,
  });
}
