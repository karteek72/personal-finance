import { roundDecimal, roundPercent } from "../lib/money.js";

/** Illustrative S&P 500 growth multiple — not a personalized backtest. */
export const TIME_MACHINE_INVEST_MULTIPLE = 1.45;
export const TIME_MACHINE_LOOKBACK_YEARS = 3;
export const TIME_MACHINE_FUTURE_COMPOUND_RATE = 0.07;
export const TIME_MACHINE_FUTURE_YEARS = 20;

export interface TimeMachineHabit {
  id: string;
  emoji: string | null;
  label: string;
  spent: string;
  investedValue: string;
  yearsAgo: number;
}

export interface TimeMachineSummary {
  lookbackYears: number;
  investMultiple: number;
  investMultipleBasis: "heuristic";
  futureCompoundRate: number;
  futureYears: number;
  habits: TimeMachineHabit[];
}

export function buildTimeMachineSummary(
  habits: Array<{
    id: string;
    emoji: string | null;
    label: string;
    monthly: string;
  }>,
): TimeMachineSummary {
  return {
    lookbackYears: TIME_MACHINE_LOOKBACK_YEARS,
    investMultiple: TIME_MACHINE_INVEST_MULTIPLE,
    investMultipleBasis: "heuristic",
    futureCompoundRate: TIME_MACHINE_FUTURE_COMPOUND_RATE,
    futureYears: TIME_MACHINE_FUTURE_YEARS,
    habits: habits.map((habit) => {
      const monthly = Number.parseFloat(habit.monthly);
      const spent = roundDecimal(monthly * 12 * TIME_MACHINE_LOOKBACK_YEARS);
      return {
        id: habit.id,
        emoji: habit.emoji,
        label: habit.label,
        spent: spent.toFixed(2),
        investedValue: roundDecimal(spent * TIME_MACHINE_INVEST_MULTIPLE).toFixed(2),
        yearsAgo: TIME_MACHINE_LOOKBACK_YEARS,
      };
    }),
  };
}

export function compoundFutureValue(
  principal: number,
  annualRate: number,
  years: number,
): number {
  return roundDecimal(principal * Math.pow(1 + annualRate, years));
}

export interface IncomeSummaryComputed {
  avgMonthlyIncome: string;
  incomeStability: number;
  sideIncomeTotal: string;
  chartYTicks: number[];
  maxBarTotal: number;
}

/** Income stability = (1 − CoV) × 100, clamped 0–100. */
export function computeIncomeStability(primary: number[]): number {
  if (primary.length === 0) return 0;
  const mean = primary.reduce((a, b) => a + b, 0) / primary.length;
  if (mean <= 0) return 0;
  const variance =
    primary.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / primary.length;
  const stdev = Math.sqrt(variance);
  const cov = stdev / mean;
  return Math.max(0, Math.min(100, Math.round((1 - cov) * 100)));
}

export function computeIncomeSummary(input: {
  months: string[];
  primary: number[];
  side: number[];
}): IncomeSummaryComputed {
  const totalIncome =
    input.primary.reduce((a, b) => a + b, 0) +
    input.side.reduce((a, b) => a + b, 0);
  const avgMonthlyIncome =
    input.months.length > 0 ? totalIncome / input.months.length : 0;
  const sideIncomeTotal = input.side.reduce((a, b) => a + b, 0);
  const maxBarTotal = Math.max(
    ...input.primary.map((v, i) => v + (input.side[i] ?? 0)),
    1,
  );
  const chartYTicks = [0, maxBarTotal / 2, maxBarTotal].map((v) =>
    Math.round(v),
  );

  return {
    avgMonthlyIncome: avgMonthlyIncome.toFixed(2),
    incomeStability: computeIncomeStability(input.primary),
    sideIncomeTotal: sideIncomeTotal.toFixed(2),
    chartYTicks,
    maxBarTotal: Math.round(maxBarTotal),
  };
}

export interface FireProjectionInput {
  currentAge: number;
  currentNetWorth: number;
  monthlySpend: number;
  monthlyInvest: number;
  withdrawalRate: number;
  realReturn: number;
}

export interface FireProjection {
  fireNumber: string;
  yearsToFire: number;
  fireAge: number;
  investingRate: number;
  curve: number[];
}

/** Years to FIRE with monthly compound growth + fixed monthly contributions. */
export function yearsToFireTarget(input: {
  start: number;
  monthly: number;
  target: number;
  annualReturn: number;
}): number {
  let balance = input.start;
  const monthlyReturn = input.annualReturn / 12;
  let months = 0;
  while (balance < input.target && months < 1200) {
    balance = balance * (1 + monthlyReturn) + input.monthly;
    months += 1;
  }
  return roundDecimal(months / 12, 2);
}

export function computeFireProjection(input: FireProjectionInput): FireProjection {
  const withdrawalFraction = input.withdrawalRate / 100;
  const fireNumber =
    withdrawalFraction > 0
      ? (input.monthlySpend * 12) / withdrawalFraction
      : 0;
  const years = yearsToFireTarget({
    start: input.currentNetWorth,
    monthly: input.monthlyInvest,
    target: fireNumber,
    annualReturn: input.realReturn / 100,
  });
  const fireAge = roundDecimal(input.currentAge + years, 1);
  const cashFlow = input.monthlySpend + input.monthlyInvest;
  const investingRate =
    cashFlow > 0
      ? roundPercent((input.monthlyInvest / cashFlow) * 100)
      : 0;

  const curve: number[] = [];
  let balance = input.currentNetWorth;
  const cap = Math.min(Math.ceil(years) + 2, 45);
  for (let y = 0; y <= cap; y++) {
    curve.push(roundDecimal(balance));
    for (let m = 0; m < 12; m++) {
      balance =
        balance * (1 + input.realReturn / 100 / 12) + input.monthlyInvest;
    }
  }

  return {
    fireNumber: fireNumber.toFixed(2),
    yearsToFire: years,
    fireAge,
    investingRate,
    curve,
  };
}

/** Monthly contribution required to reach target balance within years. */
export function computeRequiredMonthlySavings(input: {
  start: number;
  target: number;
  years: number;
  annualReturn: number;
}): number {
  if (input.target <= input.start) return 0;
  if (input.years <= 0) {
    return roundDecimal(Math.max(0, input.target - input.start), 2);
  }

  const months = input.years * 12;
  const monthlyRate = input.annualReturn / 12;
  if (monthlyRate <= 0) {
    return roundDecimal(Math.max(0, (input.target - input.start) / months), 2);
  }

  const factor = (1 + monthlyRate) ** months;
  const futureFromStart = input.start * factor;
  if (futureFromStart >= input.target) return 0;

  const payment =
    ((input.target - futureFromStart) * monthlyRate) / (factor - 1);
  return roundDecimal(Math.max(0, payment), 2);
}

export interface FilteredPortfolioTotals {
  portfolioValue: string;
  totalCostBasis: string;
  totalGainLoss: string;
  totalGainLossPercent: number;
}

export function computeFilteredPortfolioTotals(
  positions: Array<{
    value: string;
    quantity: number;
    costBasis: string;
  }>,
): FilteredPortfolioTotals {
  let portfolioValue = 0;
  let totalCostBasis = 0;
  for (const position of positions) {
    portfolioValue += Number.parseFloat(position.value);
    totalCostBasis += position.quantity * Number.parseFloat(position.costBasis);
  }
  const totalGainLoss = portfolioValue - totalCostBasis;
  return {
    portfolioValue: portfolioValue.toFixed(2),
    totalCostBasis: totalCostBasis.toFixed(2),
    totalGainLoss: totalGainLoss.toFixed(2),
    totalGainLossPercent:
      totalCostBasis > 0
        ? roundPercent((totalGainLoss / totalCostBasis) * 100)
        : 0,
  };
}
