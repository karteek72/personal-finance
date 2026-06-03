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
  source?: "import" | "plaid";
  plaidItemId?: string | null;
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
  income: { sources: FlowLine[]; total: string };
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
  current: { netWorth: string; totalAssets: string; totalLiabilities: string };
  trend: { month: string; netWorth: string }[];
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
  holdings: InvestmentHolding[];
  behavioralAlerts: { type: string; title: string; desc: string }[];
}

export interface BudgetsResponse {
  periodMonth: string;
  safeToSpend: string;
  daysRemaining: number;
  budgets: {
    category: string;
    emoji: string | null;
    color: string | null;
    spent: string;
    limit: string;
  }[];
  goals: {
    name: string;
    emoji: string | null;
    color: string | null;
    target: string;
    current: string;
    deadline: string | null;
  }[];
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
  subscriptions: RecurringItem[];
  bills: RecurringItem[];
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
  };
}

export interface FireResponse {
  currentAge: number;
  currentNetWorth: string;
  monthlySpend: string;
  monthlyInvest: string;
  withdrawalRate: number;
  realReturn: number;
}

export interface WellnessResponse {
  score: number;
  delta: number;
  history: { month: string; score: number }[];
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
}

export interface PatternsResponse {
  dayOfWeek: { day: string; value: string }[];
  patterns: {
    label: string;
    value: string;
    description: string;
    severity: string;
  }[];
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
  categories: {
    name: string;
    share: number;
    inflation: number;
    severity: string;
  }[];
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
}

export interface WrappedResponse {
  year: number;
  totalSpent: string;
  transactionCount: number;
  totalSaved: string;
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
  merchantCount: number;
  incomeSources: number;
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
