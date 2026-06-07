export {
  buildMetricEnvelope,
  buildPercentTrend,
  metricNumericValue,
  type MetricBasis,
  type MetricClass,
  type MetricEnvelope,
  type MetricTrend,
  type MetricUnit,
  type TrendDirection,
} from "./types.js";

export {
  computeSavingsRate,
  savingsRateMetric,
  type SavingsRateMetricInput,
} from "./savings-rate.js";

export {
  computeBurnRate,
  burnRateMetric,
  type BurnRateMetricInput,
} from "./burn-rate.js";

export {
  computeFreeCashFlow,
  freeCashFlowMetric,
  type FreeCashFlowMetricInput,
} from "./free-cash-flow.js";

export {
  computeEmergencyMonths,
  emergencyMonthsMetric,
  type EmergencyMonthsMetricInput,
} from "./emergency-months.js";

export {
  ESSENTIAL_CATEGORIES,
  isEssentialCategory,
} from "./essential-categories.js";

export {
  monthCashflowTotals,
  trailingEssentialOutflow,
  type PeriodCashflowTotals,
} from "./transaction-aggregates.js";

export {
  spendClassBreakdownForPeriod,
  discretionaryOutflowForPeriod,
  discretionaryShareMetric,
  type SpendClassBreakdown,
} from "./spend-class.js";

export {
  computeNetInvestmentRate,
  netInvestmentRateMetric,
} from "./net-investment-rate.js";

export {
  computeTrueSavingsRate,
  trueSavingsRateMetric,
} from "./true-savings-rate.js";
