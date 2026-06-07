import { roundDecimal } from "../lib/money.js";
import {
  buildMetricEnvelope,
  type MetricEnvelope,
} from "./metrics/types.js";

export type ResilienceBand =
  | "critical"
  | "vulnerable"
  | "stable"
  | "resilient"
  | "fortified";

export interface ResilienceSubScore {
  id: string;
  name: string;
  score: number;
  weight: number;
  band: ResilienceBand;
  action: string;
  metric: MetricEnvelope;
}

export interface ResilienceComposite {
  score: number;
  band: ResilienceBand;
  confidence: number;
  subScores: ResilienceSubScore[];
}

const WEIGHTS = {
  liquidity: 0.3,
  incomeStability: 0.2,
  expenseFlexibility: 0.2,
  debtBurden: 0.2,
  investmentLiquidity: 0.1,
} as const;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function resilienceBand(score: number): ResilienceBand {
  if (score < 40) return "critical";
  if (score < 60) return "vulnerable";
  if (score < 75) return "stable";
  if (score < 90) return "resilient";
  return "fortified";
}

export function computeLiquidityScore(emergencyMonths: number): number {
  return clampScore(Math.min(emergencyMonths / 6, 1) * 100);
}

export function computeIncomeStabilityScore(
  monthlyIncomes: number[],
  incomeSourceCount: number,
): number {
  if (monthlyIncomes.length === 0) return 0;
  const mean =
    monthlyIncomes.reduce((s, v) => s + v, 0) / monthlyIncomes.length;
  if (mean <= 0) return 0;
  const variance =
    monthlyIncomes.reduce((s, v) => s + (v - mean) ** 2, 0) /
    monthlyIncomes.length;
  const stdev = Math.sqrt(variance);
  const cov = stdev / mean;
  let score = clampScore((1 - cov) * 100);
  if (incomeSourceCount <= 1) {
    score = Math.min(score, 70);
  }
  return score;
}

export function computeExpenseFlexibilityScore(
  discretionaryOutflow: number,
  totalOutflow: number,
): number {
  if (totalOutflow <= 0) return 50;
  return clampScore((discretionaryOutflow / totalOutflow) * 100);
}

export function computeDebtBurdenScore(dti: number): number {
  return clampScore(100 - Math.min(dti / 0.36, 1) * 100);
}

export function computeInvestmentLiquidityScore(
  liquidInvest: number,
  totalInvest: number,
): number {
  if (totalInvest <= 0) return 50;
  return clampScore((liquidInvest / totalInvest) * 100);
}

function actionForSubScore(id: string, score: number): string {
  if (score >= 75) {
    return "Maintain current buffers — you're in good shape here.";
  }
  switch (id) {
    case "liquidity":
      return "Build your emergency fund toward 3–6 months of essential expenses.";
    case "incomeStability":
      return "Diversify income sources or increase cash reserves to absorb volatility.";
    case "expenseFlexibility":
      return "Reduce fixed commitments or shift spending toward discretionary choices.";
    case "debtBurden":
      return "Pay down high-interest debt to lower your debt-to-income ratio.";
    case "investmentLiquidity":
      return "Keep a portion of investments in liquid cash or money-market funds.";
    default:
      return "Review this area for the highest-impact improvement.";
  }
}

export function buildResilienceComposite(input: {
  emergencyMonths: number;
  monthlyIncomes: number[];
  incomeSourceCount: number;
  discretionaryOutflow: number;
  totalOutflow: number;
  dti: number;
  liquidInvest: number;
  totalInvest: number;
  asOf: string;
  confidence?: number;
  caveats?: string[];
}): ResilienceComposite {
  const liquidity = computeLiquidityScore(input.emergencyMonths);
  const incomeStability = computeIncomeStabilityScore(
    input.monthlyIncomes,
    input.incomeSourceCount,
  );
  const expenseFlexibility = computeExpenseFlexibilityScore(
    input.discretionaryOutflow,
    input.totalOutflow,
  );
  const debtBurden = computeDebtBurdenScore(input.dti);
  const investmentLiquidity = computeInvestmentLiquidityScore(
    input.liquidInvest,
    input.totalInvest,
  );

  const subScores: ResilienceSubScore[] = [
    {
      id: "liquidity",
      name: "Liquidity",
      score: liquidity,
      weight: WEIGHTS.liquidity,
      band: resilienceBand(liquidity),
      action: actionForSubScore("liquidity", liquidity),
      metric: buildMetricEnvelope({
        value: liquidity,
        unit: "score",
        asOf: input.asOf,
        class: "diagnostic",
        basis: "factual",
        confidence: input.confidence ?? 0.85,
      }),
    },
    {
      id: "incomeStability",
      name: "Income stability",
      score: incomeStability,
      weight: WEIGHTS.incomeStability,
      band: resilienceBand(incomeStability),
      action: actionForSubScore("incomeStability", incomeStability),
      metric: buildMetricEnvelope({
        value: incomeStability,
        unit: "score",
        asOf: input.asOf,
        class: "diagnostic",
        basis: input.incomeSourceCount <= 1 ? "heuristic" : "factual",
        confidence: input.incomeSourceCount <= 1 ? 0.7 : 0.85,
        caveats:
          input.incomeSourceCount <= 1
            ? ["Single income source — stability capped at 70"]
            : undefined,
      }),
    },
    {
      id: "expenseFlexibility",
      name: "Expense flexibility",
      score: expenseFlexibility,
      weight: WEIGHTS.expenseFlexibility,
      band: resilienceBand(expenseFlexibility),
      action: actionForSubScore("expenseFlexibility", expenseFlexibility),
      metric: buildMetricEnvelope({
        value: expenseFlexibility,
        unit: "score",
        asOf: input.asOf,
        class: "diagnostic",
        basis: "heuristic",
        confidence: 0.75,
      }),
    },
    {
      id: "debtBurden",
      name: "Debt burden",
      score: debtBurden,
      weight: WEIGHTS.debtBurden,
      band: resilienceBand(debtBurden),
      action: actionForSubScore("debtBurden", debtBurden),
      metric: buildMetricEnvelope({
        value: debtBurden,
        unit: "score",
        asOf: input.asOf,
        class: "diagnostic",
        basis: "factual",
        confidence: input.confidence ?? 0.8,
      }),
    },
    {
      id: "investmentLiquidity",
      name: "Investment liquidity",
      score: investmentLiquidity,
      weight: WEIGHTS.investmentLiquidity,
      band: resilienceBand(investmentLiquidity),
      action: actionForSubScore("investmentLiquidity", investmentLiquidity),
      metric: buildMetricEnvelope({
        value: investmentLiquidity,
        unit: "score",
        asOf: input.asOf,
        class: "diagnostic",
        basis: "heuristic",
        confidence: input.totalInvest > 0 ? 0.7 : 0.4,
        caveats:
          input.totalInvest <= 0
            ? ["No investment accounts linked"]
            : undefined,
      }),
    },
  ];

  const composite = clampScore(
    subScores.reduce((s, sub) => s + sub.score * sub.weight, 0),
  );

  const subConfidences = subScores.map((s) => s.metric.confidence);
  const confidence = roundDecimal(
    subConfidences.length > 0
      ? Math.min(...subConfidences) * 0.6 + (input.confidence ?? 0.85) * 0.4
      : 0.5,
    2,
  );

  return {
    score: composite,
    band: resilienceBand(composite),
    confidence,
    subScores,
  };
}
