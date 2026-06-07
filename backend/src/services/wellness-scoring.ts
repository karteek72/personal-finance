import type { WellnessResponse } from "./insights-store.js";

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Score a metric against an ideal target.
 * @param value — actual measured value
 * @param target — ideal target value
 * @param higherIsBetter — when false, score decreases as value rises above target
 */
export function scoreFromRatio(
  value: number,
  target: number,
  higherIsBetter: boolean,
): number {
  if (target <= 0) {
    return 50;
  }
  const epsilon = 0.000_1;
  const raw = higherIsBetter
    ? (value / target) * 100
    : (target / Math.max(value, epsilon)) * 100;
  return clampScore(raw);
}

export function compositeScore(
  dimensions: WellnessResponse["dimensions"],
): number {
  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  const weighted = dimensions.reduce((s, d) => s + d.score * d.weight, 0);
  return totalWeight > 0 ? clampScore(weighted / totalWeight) : 0;
}

export function compositeConfidence(
  dimensions: WellnessResponse["dimensions"],
): number {
  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = dimensions.reduce(
    (s, d) => s + (d.confidence ?? 1) * d.weight,
    0,
  );
  return Math.max(0, Math.min(1, weighted / totalWeight));
}

const CASH_FLOW_DIMENSION_NAMES = new Set(["Savings Rate", "Free Cash Flow"]);

/** History score using only transaction-derived dimensions (no balance snapshots). */
export function compositeCashFlowScore(
  dimensions: WellnessResponse["dimensions"],
): number {
  const cashFlowDims = dimensions.filter((d) =>
    CASH_FLOW_DIMENSION_NAMES.has(d.name),
  );
  return compositeScore(cashFlowDims);
}

export interface GoalPaceInput {
  target: number;
  current: number;
  deadline: string | null;
  createdAt: Date;
  asOf?: Date;
}

/** Deadline-aware on-track ratio for a single goal. */
export function goalOnTrackRatio(goal: GoalPaceInput): number | null {
  if (goal.target <= 0) return null;
  if (!goal.deadline) return null;

  const asOf = goal.asOf ?? new Date();
  const deadline = new Date(`${goal.deadline}T12:00:00Z`);
  const created = goal.createdAt;
  if (deadline <= created) return goal.current / goal.target;

  const totalMs = deadline.getTime() - created.getTime();
  const elapsedMs = Math.max(0, asOf.getTime() - created.getTime());
  const expectedProgress = Math.min(1, elapsedMs / totalMs);
  const actualProgress = goal.current / goal.target;
  if (expectedProgress <= 0) return actualProgress >= 1 ? 1 : 0;
  return actualProgress / expectedProgress;
}

export function goalPaceScore(goals: GoalPaceInput[]): {
  score: number;
  onTrack: number;
  count: number;
} {
  const withDeadline = goals.filter((g) => g.deadline && g.target > 0);
  if (withDeadline.length === 0) {
    return { score: 50, onTrack: 0, count: 0 };
  }

  let onTrack = 0;
  for (const goal of withDeadline) {
    const ratio = goalOnTrackRatio(goal);
    if (ratio != null && ratio >= 0.9) onTrack += 1;
  }

  return {
    score: clampScore((onTrack / withDeadline.length) * 100),
    onTrack,
    count: withDeadline.length,
  };
}

export interface HealthDimensionInput {
  savingsRate: number;
  freeCashFlow: number;
  income: number;
  emergencyMonths: number;
  utilization: number | null;
  netInvestRate: number | null;
  spendingVolatility: number | null;
  discretionaryShare: number | null;
  goals: GoalPaceInput[];
  dataQualityConfidence?: number;
}

function scaleConfidence(base: number, dataQuality?: number): number {
  const dq = dataQuality ?? 1;
  return Math.max(0, Math.min(1, base * dq));
}

function trendFromScore(score: number): string {
  return score >= 70 ? "up" : score >= 50 ? "neutral" : "down";
}

/** Financial Health sub-scores per analytics-architecture.md section 6. */
export function buildWellnessDimensions(
  input: HealthDimensionInput,
): WellnessResponse["dimensions"] {
  const dq = input.dataQualityConfidence ?? 1;
  const savingsScore = clampScore(Math.min(input.savingsRate / 0.2, 1) * 100);

  const fcfRatio =
    input.income > 0 ? Math.max(input.freeCashFlow, 0) / input.income : 0;
  const fcfScore =
    input.freeCashFlow > 0 ? clampScore(Math.min(fcfRatio / 0.15, 1) * 100) : 0;

  const emergencyScore = clampScore(
    Math.min(input.emergencyMonths / 6, 1) * 100,
  );

  const goalStats = goalPaceScore(input.goals);

  const dimensions: WellnessResponse["dimensions"] = [
    {
      name: "Savings Rate",
      score: savingsScore,
      weight: 22,
      confidence: scaleConfidence(0.95, dq),
      description: `You save ${(input.savingsRate * 100).toFixed(1)}% of income. Target: 20%+`,
      trend: trendFromScore(savingsScore),
    },
    {
      name: "Free Cash Flow",
      score: fcfScore,
      weight: 16,
      confidence: scaleConfidence(0.75, dq),
      description:
        input.freeCashFlow > 0
          ? `Free cash flow ${input.freeCashFlow.toFixed(0)}/mo after essentials`
          : "Free cash flow is zero or negative after essentials",
      trend: trendFromScore(fcfScore),
    },
    {
      name: "Emergency Fund",
      score: emergencyScore,
      weight: 16,
      confidence: scaleConfidence(0.9, dq),
      description: `${input.emergencyMonths.toFixed(1)} months of essential burn covered. Target: 6+`,
      trend: trendFromScore(emergencyScore),
    },
    {
      name: "Goal Pace",
      score: goalStats.score,
      weight: 6,
      confidence: scaleConfidence(goalStats.count > 0 ? 0.85 : 0.5, dq),
      description:
        goalStats.count > 0
          ? `${goalStats.onTrack}/${goalStats.count} goals on pace for their deadline`
          : "Add goals with deadlines to track pace",
      trend: trendFromScore(goalStats.score),
    },
  ];

  if (input.utilization !== null) {
    const debtScore = scoreFromRatio(input.utilization, 30, false);
    dimensions.splice(3, 0, {
      name: "Debt Health",
      score: debtScore,
      weight: 16,
      confidence: scaleConfidence(0.9, dq),
      description: `Credit utilization ${input.utilization.toFixed(0)}%. Target: <30%`,
      trend: trendFromScore(debtScore),
    });
  }

  if (input.netInvestRate !== null) {
    const investScore = clampScore(Math.min(input.netInvestRate / 0.15, 1) * 100);
    dimensions.push({
      name: "Investing",
      score: investScore,
      weight: 14,
      confidence: scaleConfidence(0.8, dq),
      description: `Net investment rate ${(input.netInvestRate * 100).toFixed(1)}% of income`,
      trend: trendFromScore(investScore),
    });
  } else {
    dimensions.push({
      name: "Investing",
      score: 45,
      weight: 14,
      confidence: scaleConfidence(0.3, dq),
      description: "Connect investment accounts to score contribution rate",
      trend: "neutral",
      caveats: ["Investment activity unknown"],
    });
  }

  const volatility = input.spendingVolatility ?? 0.5;
  const discretionary = input.discretionaryShare ?? 0.35;
  const volatilityScore = clampScore((1 - Math.min(volatility, 1)) * 50);
  const discretionaryScore = clampScore(
    (1 - Math.min(discretionary / 0.5, 1)) * 50,
  );
  const disciplineScore = clampScore(volatilityScore + discretionaryScore);
  dimensions.push({
    name: "Spending Discipline",
    score: disciplineScore,
    weight: 10,
    confidence: scaleConfidence(
      input.spendingVolatility != null ? 0.8 : 0.55,
      dq,
    ),
    description: `Discretionary share ${(discretionary * 100).toFixed(0)}% of outflow`,
    trend: trendFromScore(disciplineScore),
  });

  return dimensions;
}

/** Average spend on a single calendar occurrence of a weekday. */
export function averageSpendPerWeekdayOccurrence(
  total: number,
  distinctDates: number,
): number {
  if (distinctDates <= 0 || !Number.isFinite(total)) {
    return 0;
  }
  return total / distinctDates;
}

/** Count days in [year-01-01, effectiveEnd] with no recorded spend. */
export function countNoSpendDays(input: {
  year: number;
  spendDates: Set<string> | Iterable<string>;
  today?: string;
}): number {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const yearEnd = `${input.year}-12-31`;
  const effectiveEnd = today < yearEnd ? today : yearEnd;

  const spendSet =
    input.spendDates instanceof Set
      ? input.spendDates
      : new Set(input.spendDates);

  const startDate = new Date(`${input.year}-01-01T12:00:00Z`);
  const endDate = new Date(`${effectiveEnd}T12:00:00Z`);
  let count = 0;

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const key = d.toISOString().slice(0, 10);
    if (!spendSet.has(key)) {
      count += 1;
    }
  }

  return count;
}
