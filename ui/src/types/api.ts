export interface User {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface AuthSessionResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface AuthRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AccountCreditLiability {
  lastStatementBalance: string | null;
  lastStatementIssueDate: string | null;
  minimumPaymentAmount: string | null;
  nextPaymentDueDate: string | null;
  lastPaymentAmount: string | null;
  lastPaymentDate: string | null;
  isOverdue: boolean | null;
  aprs: {
    aprType: string;
    aprPercentage: string;
    balanceSubjectToApr: string | null;
    interestChargeAmount: string | null;
  }[];
  purchaseApr: string | null;
  estimatedMonthlyInterest: string | null;
  statementVsCurrentDelta: string | null;
  daysUntilDue: number | null;
  syncedAt: string | null;
}

export interface Account {
  id: string;
  name: string;
  officialName: string | null;
  type: "depository" | "credit" | "investment";
  subtype: string | null;
  mask: string | null;
  balanceCurrent: string;
  balanceAvailable: string | null;
  currencyCode: string;
  institutionName: string;
  lastSyncedAt: string | null;
  status: "active" | "error" | "reauth_required";
  source?: "import" | "plaid" | "teller" | "snaptrade";
  connectionProvider?: "plaid" | "teller" | "snaptrade" | "import";
  plaidItemId?: string | null;
  tellerEnrollmentId?: string | null;
  memberId?: string | null;
  memberName?: string | null;
  memberColor?: string | null;
  liability?: AccountCreditLiability | null;
}

export interface CreditCardDebtRow {
  accountId: string;
  name: string;
  mask: string | null;
  institutionName: string;
  balanceCurrent: string;
  liability: AccountCreditLiability | null;
}

export interface CreditDebtSummary {
  totalCurrentBalance: string;
  totalStatementBalance: string;
  totalMinimumDue: string;
  totalEstimatedMonthlyInterest: string;
  overdueCount: number;
  coverageLabel: string;
  cards: CreditCardDebtRow[];
}

export interface Transaction {
  id: string;
  accountId: string;
  accountMask: string | null;
  date: string;
  name: string;
  merchantName: string | null;
  amount: string;
  currencyCode: string;
  category: string;
  subCategory: string | null;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
  memberId?: string | null;
  memberName?: string | null;
  memberColor?: string | null;
}

export interface UpdateTransactionCategoryResponse {
  transaction: {
    id: string;
    category: string;
    subCategory: string | null;
    merchantKey: string;
  };
  merchantTransactionsUpdated: number;
}

export interface TransactionSummary {
  totalSpent: string;
  income: string;
  netSavings: string;
  avgMonthlySpend: string;
  topCategory: { name: string; amount: string };
  ccPaymentsExcluded: string;
  /** 0–1 fraction; multiply by 100 once at display (unit=percent). */
  savingsRate: number;
  transactionCount: number;
  pendingCount: number;
  /** Calendar months in the summary date range (for avg/month). */
  monthsInPeriod?: number;
}

export interface FlowLine {
  label: string;
  amount: string;
}

export interface MoneyFlowResponse {
  income: { sources: Page<FlowLine>; total: string };
  bankAccounts: { accounts: FlowLine[]; transfersOut: string };
  creditCards: { accounts: FlowLine[]; totalCharges: string };
  monthlySeries: {
    month: string;
    income: string;
    expenses: string;
    net: string;
  }[];
}

export interface Alert {
  id: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  dismissible: boolean;
}

export interface SubCategoryTotal {
  name: string;
  amount: string;
  percentage: number;
}

export interface CategoryTotal {
  name: string;
  amount: string;
  percentage: number;
  deltaVsPriorMonth: number;
  subcategories?: SubCategoryTotal[];
}

export interface CategoryTrend {
  name: string;
  months: { month: string; amount: string }[];
}

export type ConnectionProviderId = "plaid" | "teller" | "snaptrade";

export interface ConnectionProviderOption {
  id: ConnectionProviderId;
  label: string;
  description: string;
  accountTypes: ("depository" | "credit" | "investment")[];
  enabled: boolean;
}

export interface ConnectionProvidersResponse {
  providers: ConnectionProviderOption[];
}

export interface TellerConnectConfig {
  applicationId: string;
  environment: "sandbox" | "development" | "production";
  products: string[];
}

export interface TellerExchangeResponse {
  enrollmentId: string;
  institutionName: string;
  accountsSynced: number;
  transactionsAdded: number;
  message: string;
}

export interface SnaptradePortalResponse {
  redirectUri: string;
}

export interface SnaptradeCompleteResponse {
  status: string;
  connectionsSynced: number;
  accountsSynced: number;
  holdingsUpdated: number;
  activitiesAdded: number;
  message: string;
}

export interface PlaidExchangeResponse {
  itemId: string;
  institutionName: string;
  accountsSynced: number;
  transactionsAdded: number;
  message: string;
}

export interface PlaidItem {
  id: string;
  plaidItemId: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface PlaidItemsResponse {
  items: PlaidItem[];
}

export interface PlaidSyncResponse {
  status: string;
  itemId: string;
  institutionName: string;
  accountsSynced: number;
  added: number;
  modified: number;
  removed: number;
  message?: string;
}

export interface PlaidSyncAllResponse {
  status: string;
  itemsSynced: number;
  added: number;
  modified: number;
  removed: number;
  message?: string;
  failures?: { itemId: string; institutionName: string | null; message: string }[];
}

export interface PaginatedTransactions {
  items: Transaction[];
  nextCursor: string | null;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface DeleteAccountResponse {
  id: string;
  name: string;
  mask: string;
  transactionsDeleted: number;
  /** True when this was the last account on a Plaid link and the bank was disconnected. */
  plaidItemDisconnected: boolean;
}

export interface AlertsResponse {
  alerts: Alert[];
}

export interface CategoriesResponse {
  categories: CategoryTotal[];
}

export interface TrendsResponse {
  trends: CategoryTrend[];
}

export interface ChartMonthlyPoint {
  month: string;
  expenses: string;
  income: string;
  net: string;
}

export interface ChartYearlyPoint {
  year: string;
  expenses: string;
  income: string;
  net: string;
}

export interface ChartCategorySlice {
  name: string;
  amount: string;
  percentage: number;
}

export interface ChartAccountSlice {
  id: string;
  name: string;
  amount: string;
  percentage: number;
}

export interface ChartMemberSlice {
  id: string;
  name: string;
  color: string;
  amount: string;
  percentage: number;
}

export interface ChartDataResponse {
  monthly: ChartMonthlyPoint[];
  /** Full-history yearly totals when data spans more than one calendar year. */
  yearly: ChartYearlyPoint[];
  byCategory: ChartCategorySlice[];
  bySubCategory: ChartCategorySlice[];
  byAccount: ChartAccountSlice[];
  byMember: ChartMemberSlice[];
  categoryTrends: CategoryTrend[];
  totals: {
    expenses: string;
    income: string;
    net: string;
  };
}

export interface ChartDataFilters {
  from?: string;
  to?: string;
  accountId?: string;
  category?: string;
  memberId?: string;
  scope?: "all" | "household" | "personal";
}

export type HouseholdMemberRole = "owner" | "partner" | "child" | "other";

export interface HouseholdMemberInvite {
  id: string;
  email: string;
  expiresAt: string;
  status: "pending" | "expired";
}

export interface HouseholdMember {
  id: string;
  displayName: string;
  role: HouseholdMemberRole;
  avatarColor: string;
  userId: string | null;
  createdAt: string;
  pendingInvite?: HouseholdMemberInvite | null;
}

export interface HouseholdAccountLink {
  accountId: string;
  name: string;
  mask: string;
  institutionName: string;
  balanceCurrent: string;
  memberId: string | null;
  memberName: string | null;
  memberColor: string | null;
  ownedByCurrentUser?: boolean;
  ownerUserId?: string;
}

export interface HouseholdResponse {
  accessRole: "owner" | "member";
  household: {
    id: string;
    name: string;
    createdAt: string;
  };
  members: HouseholdMember[];
  accounts: HouseholdAccountLink[];
}

export interface HouseholdInviteResponse {
  invitationId: string;
  inviteUrl: string;
  expiresAt: string;
  email: string;
}

export interface HouseholdInvitePreview {
  householdName: string;
  memberName: string;
  memberRole: string;
  email: string;
  expiresAt: string;
  status: "pending" | "expired" | "accepted";
}

export interface HouseholdInviteAcceptResponse {
  householdId: string;
  householdName: string;
  memberId: string;
  memberDisplayName: string;
}

export interface HouseholdMemberInsight {
  memberId: string;
  displayName: string;
  role: HouseholdMemberRole;
  avatarColor: string;
  accountCount: number;
  totalSpent: string;
  totalIncome: string;
  topCategory: { name: string; amount: string };
}

export interface HouseholdInsightsResponse {
  members: HouseholdMemberInsight[];
  unassignedAccounts: HouseholdAccountLink[];
  householdTotals: {
    expenses: string;
    income: string;
    net: string;
  };
  period: { from: string; to: string };
}

/* ------------------------------------------------------------------ *
 * Wealth, planning, insights, protect, coach & wrapped
 * (feature endpoints backed by the demo dataset)
 * ------------------------------------------------------------------ */

export interface NetWorthResponse {
  current: {
    netWorth: string;
    totalAssets: string;
    totalLiabilities: string;
    accountCount: number;
  };
  breakdown: {
    depository: { total: string; accountCount: number };
    investment: { total: string; accountCount: number };
    credit: { total: string; accountCount: number };
  };
  trend: { month: string; netWorth: string }[];
}

export interface InvestmentPosition {
  holdingId: string;
  accountId: string;
  accountName: string;
  institutionName: string;
  accountMask: string | null;
  ticker: string;
  name: string;
  sector: string | null;
  assetType: string;
  quantity: number;
  costBasis: string;
  currentPrice: string;
  value: string;
  gainLoss: string;
  gainLossPercent: number;
  underlyingTicker?: string | null;
  optionType?: string | null;
  expirationLabel?: string | null;
}

export interface StockAggregateLot {
  accountId: string;
  accountName: string;
  quantity: number;
  value: string;
  costBasis: string;
}

export interface StockAggregate {
  ticker: string;
  name: string;
  sector: string | null;
  assetType: string;
  totalQuantity: number;
  currentPrice: string;
  totalValue: string;
  totalCost: string;
  gainLoss: string;
  gainLossPercent: number;
  accountCount: number;
  lots: StockAggregateLot[];
}

export interface PortfolioBreakdown {
  stocksValue: string;
  optionsValue: string;
  otherValue: string;
  stocksSharePercent: number;
  optionsSharePercent: number;
  stockPositionCount: number;
  optionPositionCount: number;
  totalPositionCount: number;
}

export interface InvestmentHolding {
  ticker: string;
  name: string;
  sector: string | null;
  assetType: string;
  quantity: number;
  costBasis: string;
  currentPrice: string;
  value: string;
  gainLoss: string;
  gainLossPercent: number;
  underlyingTicker?: string | null;
  optionType?: string | null;
  expirationLabel?: string | null;
}

export interface InvestmentsResponse {
  portfolioValue: string;
  totalCostBasis: string;
  totalGainLoss: string;
  totalGainLossPercent: number;
  accounts: {
    accountId: string;
    name: string;
    institutionName: string;
    subtype: string | null;
    value: string;
  }[];
  holdings: Page<InvestmentHolding>;
  positions: Page<InvestmentPosition>;
  stockAggregates: StockAggregate[];
  optionPositions: InvestmentPosition[];
  portfolioBreakdown: PortfolioBreakdown;
  behavioralAlerts: { type: string; title: string; desc: string }[];
  investmentHistory: {
    lookbackYears: number;
    totalContributed: string;
    estimatedValueToday: string;
    currentPortfolioValue: string;
    monthlyAverageInvest: string;
    transactionCount: number;
    buyTransactionCount: number;
  } | null;
  monthlyActivity: {
    cashContributions: string;
    purchaseDeployments: string;
    totalDeployed: string;
  } | null;
}

export type BudgetSource = "user" | "suggested";
export type BudgetClass = "essential" | "discretionary";
export type GoalKind = "emergency" | "debt" | "sinking" | "surplus" | "custom";
export type GoalStatus = "active" | "achieved" | "dismissed";
export type GoalSource = "user" | "suggested";
export type SuggestionConfidence = "low" | "medium" | "high";

export interface BudgetItem {
  id?: string;
  category: string;
  emoji: string | null;
  color: string | null;
  spent: string;
  limit: string;
  source: BudgetSource;
  class?: BudgetClass | null;
  rationale?: string;
  confidence?: SuggestionConfidence;
}

export interface GoalItem {
  id?: string;
  name: string;
  emoji: string | null;
  color: string | null;
  target: string;
  current: string;
  deadline: string | null;
  kind: GoalKind;
  status: GoalStatus;
  source: GoalSource;
  rationale?: string;
  confidence?: SuggestionConfidence;
  monthlySetAside?: string;
  accountId?: string | null;
}

export interface BudgetRow {
  id: string;
  category: string;
  periodMonth: string;
  emoji: string | null;
  color: string | null;
  limit: string;
  source: BudgetSource;
  class: BudgetClass | null;
}

export interface GoalRow {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  target: string;
  current: string;
  deadline: string | null;
  kind: GoalKind;
  status: GoalStatus;
  source: GoalSource;
  accountId: string | null;
}

export interface BudgetsResponse {
  periodMonth: string;
  safeToSpend: string;
  daysRemaining: number;
  isLive: boolean;
  budgets: BudgetItem[];
  suggestedBudgets: BudgetItem[];
  goals: GoalItem[];
  suggestedGoals: GoalItem[];
}

export interface UpsertBudgetInput {
  category: string;
  periodMonth: string;
  limit: number;
  emoji?: string;
  color?: string;
  source?: BudgetSource;
  class?: BudgetClass;
}

export interface PatchBudgetInput {
  limit?: number;
  emoji?: string | null;
  color?: string | null;
  class?: BudgetClass | null;
}

export interface CreateGoalInput {
  name: string;
  target: number;
  current?: number;
  deadline?: string | null;
  emoji?: string;
  color?: string;
  kind?: GoalKind;
  status?: GoalStatus;
  source?: GoalSource;
  accountId?: string | null;
}

export interface PatchGoalInput {
  name?: string;
  target?: number;
  current?: number;
  deadline?: string | null;
  emoji?: string | null;
  color?: string | null;
  kind?: GoalKind;
  status?: GoalStatus;
  accountId?: string | null;
}

export type CostAuditType =
  | "habit"
  | "delivery"
  | "duplicate_subscription"
  | "price_hike"
  | "lapsed_subscription"
  | "impulse"
  | "fee"
  | "category_overspend"
  | "merchant_frequency";

export interface CostAudit {
  id: string;
  type: CostAuditType;
  emoji: string;
  title: string;
  monthly: string;
  annual: string;
  opportunityCost10y: string;
  rationale: string;
  action: string;
  savingsEstimate: string;
  confidence: number;
}

export interface RecurringItem {
  merchantName: string;
  category: string;
  kind: string;
  amount: string;
  cadence: string;
  nextChargeDate: string | null;
  lastChargeDate: string | null;
  previousAmount: string | null;
  priceChanged: boolean;
  status: string;
  brandColor: string | null;
}

export interface RecurringResponse {
  monthlyTotal: string;
  annualTotal: string;
  activeCount: number;
  priceChanges: number;
  isLive: boolean;
  subscriptions: Page<RecurringItem>;
  bills: Page<RecurringItem>;
  leaks: {
    fees: {
      id: string;
      label: string;
      source: string;
      count: number;
      total: string;
      fixable: boolean;
    }[];
    habits: { id: string; emoji: string | null; label: string; monthly: string }[];
    audits: CostAudit[];
  };
  timeMachine: {
    lookbackYears: number;
    investMultiple: number;
    investMultipleBasis: "heuristic";
    futureCompoundRate: number;
    futureYears: number;
    habits: Array<{
      id: string;
      emoji: string | null;
      label: string;
      spent: string;
      investedValue: string;
      yearsAgo: number;
    }>;
  };
}

export interface FireProjection {
  fireNumber: string;
  yearsToFire: number;
  fireAge: number;
  investingRate: number;
  curve: number[];
}

export interface FireResponse {
  currentAge: number;
  /** True until the user saves their age (system default is 35). */
  isDefaultAge: boolean;
  currentNetWorth: string;
  monthlySpend: string;
  monthlyInvest: string;
  withdrawalRate: number;
  realReturn: number;
  projection: FireProjection;
}

export interface FireQueryOverrides {
  monthlySpend?: number;
  monthlyInvest?: number;
  withdrawalRate?: number;
  realReturn?: number;
}

export type EmploymentStatus =
  | "employed"
  | "self_employed"
  | "retired"
  | "student"
  | "other";

export type RiskTolerance = "conservative" | "moderate" | "aggressive";

export interface UserProfilePatch {
  displayName?: string;
  currentAge?: number;
  householdSize?: number | null;
  annualGrossIncome?: number | null;
  targetRetirementAge?: number | null;
  employmentStatus?: EmploymentStatus | null;
  riskTolerance?: RiskTolerance | null;
  withdrawalRate?: number;
  realReturn?: number;
}

export interface UserProfileResponse {
  user: User;
  currentAge: number;
  isDefaultAge: boolean;
  householdSize: number | null;
  annualGrossIncome: string | null;
  targetRetirementAge: number | null;
  employmentStatus: EmploymentStatus | null;
  riskTolerance: RiskTolerance | null;
  withdrawalRate: number;
  realReturn: number;
  hasLinkedAccounts: boolean;
  currentNetWorth: string | null;
  monthlySpend: string | null;
  monthlyInvest: string | null;
}

/** @deprecated Use UserProfileResponse fields without user */
export type AnalyticsProfileResponse = Omit<UserProfileResponse, "user">;

export interface FireProfilePatch {
  currentAge?: number;
  withdrawalRate?: number;
  realReturn?: number;
}

export interface WellnessResponse {
  score: number;
  delta: number;
  history: { month: string; score: number }[];
  isLive: boolean;
  dimensions: {
    name: string;
    score: number;
    weight: number;
    description: string;
    trend: string;
  }[];
}

export interface DnaResponse {
  archetype: string;
  narrative: string;
  peerRarity: string | null;
  axes: { label: string; you: number; peers: number }[];
  isLive?: boolean;
}

export interface PatternsResponse {
  dayOfWeek: { day: string; value: string }[];
  patterns: Page<{
    label: string;
    value: string;
    description: string;
    severity: string;
  }>;
}

export interface BehavioralResponse {
  archetype: string;
  creep: { months: string[]; income: string[]; spending: string[] };
  reasons: {
    id: string;
    emoji: string;
    label: string;
    color: string;
    total: string;
  }[];
  taggedTransactions: {
    id: string;
    merchant: string;
    amount: string;
    date: string;
    reasonId: string;
  }[];
  challenges: {
    title: string;
    goal: string;
    progressPercent: number;
    daysRemaining: number;
    complete: boolean;
    color: string | null;
  }[];
  streaks: {
    label: string;
    currentDays: number;
    maxDays: number;
    color: string | null;
  }[];
}

export interface InflationResponse {
  personalRate: number;
  nationalCpi: number;
  salaryRaise: number;
  nominalSavingsRate: number;
  realSavingsRate: number;
  realRaise: number;
  powerLoss: string;
  salary: string;
  breakEvenSalary: string;
  targetSalary: string;
  categories: Page<{
    name: string;
    share: number;
    inflation: number;
    severity: string;
  }>;
}

export interface ResilienceResponse {
  liquidCash: string;
  monthlyBurn: string;
  runwayMonths: number;
  immunityScore: number;
  scenarios: {
    id: string;
    name: string;
    emoji: string | null;
    shockAmount: string;
    shockType: string;
    monthsCovered: number;
    recommendedMonths: number;
    detail: string | null;
  }[];
}

export interface CoachResponse {
  narrative: string;
  forecast: string;
  qa: { q: string; a: string }[];
  isLive?: boolean;
}

export interface CoachAskResponse {
  answer: string;
  isLive: boolean;
}

export interface WrappedResponse {
  year: number;
  totalSpent: string;
  transactionCount: number;
  totalSaved: string;
  /** 0–1 fraction; multiply by 100 once at display (unit=percent). */
  savingsRate: number;
  peerPercentile: string | null;
  archetype: string | null;
  topCategory: { name: string; amount: string };
  personality: Record<string, number>;
  moments: { label: string; value: string }[];
  goals: { label: string; target: string; pct: number }[];
}

export interface MerchantsResponse {
  merchants: {
    name: string;
    emoji: string;
    visits: number;
    total: string;
    trend: number;
    trail: number[];
  }[];
  income: { months: string[]; primary: number[]; side: number[] };
  incomeSummary: {
    avgMonthlyIncome: string;
    incomeStability: number;
    sideIncomeTotal: string;
    chartYTicks: number[];
    maxBarTotal: number;
  };
  merchantCount: number;
  incomeSources: number;
  isLive: boolean;
}

/**
 * Analytics metric envelope — every KPI/scalar in /analytics/* responses.
 * See docs/design/api-contract.md and analytics-architecture.md section 7.
 */
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

/**
 * Standard list/pagination envelope (offset pagination with total count).
 * Mirrors backend lib/list-query.ts — see analytics-architecture.md section 10.3.
 */
export interface Page<TRow> {
  rows: TRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: string;
  dir: "asc" | "desc";
  appliedFilters: Record<string, string>;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  from?: string;
  to?: string;
}

export interface MerchantRow {
  name: string;
  emoji: string;
  visits: number;
  total: string;
  avgTransaction: string;
  share: number;
  trend: number;
  lastSeen: string;
  trail: number[];
}

export interface MerchantsSummary {
  merchantCount: number;
  totalSpend: string;
  topMerchant: { name: string; total: string } | null;
  mostVisited: { name: string; visits: number } | null;
  fastestGrowing: { name: string; trend: number } | null;
}

export interface MerchantsTableResponse extends Page<MerchantRow> {
  summary: MerchantsSummary;
  isLive: boolean;
}

export interface CalendarResponse {
  month: string;
  events: { day: number; type: string; label: string; amount: string }[];
  heat: { day: number; level: number }[];
  totals: { income: string; bills: string };
  safeToSpendToday: string;
}

export interface ForecastResponse {
  days: {
    date: string;
    weekday: string;
    weather: string;
    projectedBalance: string;
    note: string;
  }[];
  comfortFloor: string;
  minBalance: string;
  lowestDay: string;
  nextClearDate: string;
  recommendation: string;
}

export interface TransactionFilters {
  month?: string;
  category?: string;
  subCategory?: string;
  accountId?: string;
  memberId?: string;
  scope?: "all" | "household" | "personal";
  q?: string;
  type?: Transaction["transactionType"];
  sort?:
    | "date_desc"
    | "date_asc"
    | "amount_desc"
    | "amount_asc"
    | "name_asc"
    | "name_desc"
    | "category_asc";
  limit?: number;
  cursor?: string;
}

export interface ImportFormatInfo {
  id: string;
  label: string;
  extensions: string[];
  description: string;
  brokers: string[];
}

export interface ImportFormatsResponse {
  formats: ImportFormatInfo[];
  limits: {
    maxFiles: number;
    maxFileBytes: number;
    maxBatchBytes: number;
  };
  consentVersion: string;
}

export interface ImportBatchCreateResponse {
  batchId: string;
  status: "pending" | "processing" | "awaiting_confirmation" | "completed" | "failed";
  filesTotal: number;
  message: string;
}

export interface ImportActiveBatchResponse {
  activeBatchId: string | null;
  status?: string;
  filesTotal?: number;
  createdAt?: string;
}

export interface ApiErrorDetails {
  activeBatchId?: string;
}

export interface ImportFilePreviewSummary {
  accounts: {
    institutionName: string;
    mask: string;
    type: string;
    subtype: string;
    matchedAccountId: string | null;
    bankingCount: number;
    investmentCount: number;
  }[];
  dateRange: { min: string | null; max: string | null };
  sampleTransactions: { date: string; name: string; amount: string }[];
}

export interface ImportBatchSummary {
  total: number;
  pending: number;
  ready: number;
  failed: number;
  imported: number;
  bankingTransactions: number;
  investmentTransactions: number;
  canRetryFailed: boolean;
  canConfirm: boolean;
}

export interface ImportBatchStatusResponse {
  batch: {
    id: string;
    status: string;
    filesTotal: number;
    filesProcessed: number;
    txnsInserted: number;
    txnsSkipped: number;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  };
  summary: ImportBatchSummary;
  files: {
    id: string;
    filename: string;
    format: string;
    byteSize: number;
    status: string;
    errorMessage: string | null;
    canRetry: boolean;
    canReplace: boolean;
    preview: ImportFilePreviewSummary | null;
  }[];
}

export interface ImportConfirmResponse {
  batchId: string;
  status: "completed" | "awaiting_confirmation";
  txnsInserted: number;
  txnsSkipped: number;
  filesImported: number;
  message: string;
}
