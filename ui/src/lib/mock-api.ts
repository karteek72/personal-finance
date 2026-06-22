import accountsData from "@/mocks/accounts.json";
import alertsData from "@/mocks/alerts.json";
import categoriesData from "@/mocks/categories.json";
import moneyFlowData from "@/mocks/money-flow.json";
import summaryData from "@/mocks/summary.json";
import transactionsData from "@/mocks/transactions.json";
import trendsData from "@/mocks/trends.json";
import netWorthData from "@/mocks/net-worth.json";
import investmentsData from "@/mocks/investments.json";
import budgetsData from "@/mocks/budgets.json";
import recurringData from "@/mocks/recurring.json";
import wellnessData from "@/mocks/wellness.json";
import dnaData from "@/mocks/dna.json";
import patternsData from "@/mocks/patterns.json";
import behavioralData from "@/mocks/behavioral.json";
import inflationData from "@/mocks/inflation.json";
import resilienceData from "@/mocks/resilience.json";
import fireData from "@/mocks/fire.json";
import coachData from "@/mocks/coach.json";
import wrappedData from "@/mocks/wrapped.json";
import merchantsData from "@/mocks/merchants.json";
import calendarData from "@/mocks/calendar.json";
import forecastData from "@/mocks/forecast.json";
import type {
  Account,
  AccountsResponse,
  AlertsResponse,
  BehavioralResponse,
  BudgetRow,
  BudgetsResponse,
  CreateGoalInput,
  GoalRow,
  PatchBudgetInput,
  PatchGoalInput,
  UpsertBudgetInput,
  CalendarResponse,
  CategoriesResponse,
  ChartDataResponse,
  CoachResponse,
  CreditDebtSummary,
  DnaResponse,
  FireProjection,
  FireQueryOverrides,
  FireResponse,
  UserProfileResponse,
  UserProfilePatch,
  AnalyticsProfileResponse,
  FireProfilePatch,
  ForecastResponse,
  HouseholdInsightsResponse,
  HouseholdMember,
  HouseholdResponse,
  InflationResponse,
  InvestmentsResponse,
  InvestmentPosition,
  StockAggregate,
  ListQuery,
  MerchantRow,
  MerchantsResponse,
  MerchantsTableResponse,
  MoneyFlowResponse,
  NetWorthResponse,
  Page,
  PaginatedTransactions,
  PatternsResponse,
  RecurringResponse,
  ResilienceResponse,
  Transaction,
  TransactionFilters,
  TransactionSummary,
  TrendsResponse,
  UpdateTransactionCategoryResponse,
  WellnessResponse,
  WrappedResponse,
} from "@/types/api";

const MOCK_DELAY_MS = 150;

function mockListPage<TRow>(
  rows: TRow[],
  sort = "amount",
  dir: "asc" | "desc" = "desc",
): Page<TRow> {
  return {
    rows,
    page: 1,
    pageSize: Math.max(rows.length, 25),
    total: rows.length,
    totalPages: 1,
    sort,
    dir,
    appliedFilters: {},
  };
}

function paginateMockRows<TRow>(
  rows: TRow[],
  params: ListQuery,
  sortKeys: Record<string, (row: TRow) => number | string>,
  defaultSort: string,
  textMatch?: (row: TRow, needle: string) => boolean,
): Page<TRow> {
  const needle = params.q?.toLowerCase();
  let filtered =
    needle && textMatch
      ? rows.filter((row) => textMatch(row, needle))
      : rows;
  const sort = params.sort ?? defaultSort;
  const dir = params.dir ?? "desc";
  const factor = dir === "asc" ? 1 : -1;
  const keyFn = sortKeys[sort] ?? sortKeys[defaultSort]!;
  filtered = [...filtered].sort((a, b) => {
    const av = keyFn(a);
    const bv = keyFn(b);
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * factor;
    }
    return String(av).localeCompare(String(bv)) * factor;
  });
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const total = filtered.length;
  return {
    rows: filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    sort,
    dir,
    appliedFilters: needle ? { q: needle } : {},
  };
}

const INTERNAL_TRANSFER_CATEGORY = "Internal Transfers";
const CREDIT_CARD_PAYMENT_SUBCATEGORY = "Credit Card Payments";

const INITIAL_MOCK_ACCOUNTS = (accountsData as AccountsResponse).accounts;
const mockAccounts: Account[] = structuredClone(INITIAL_MOCK_ACCOUNTS);
let mockTransactionItems: Transaction[] = structuredClone(
  (transactionsData as PaginatedTransactions).items,
);
let mockDataMutated = false;

const EMPTY_SUMMARY: TransactionSummary = {
  totalSpent: "0.00",
  income: "0.00",
  netSavings: "0.00",
  avgMonthlySpend: "0.00",
  topCategory: { name: "None", amount: "0.00" },
  ccPaymentsExcluded: "0.00",
  savingsRate: 0,
  transactionCount: 0,
  pendingCount: 0,
  monthsInPeriod: 1,
};

function activeMockAccountIds(): Set<string> {
  return new Set(mockAccounts.map((account) => account.id));
}

function filterMockTransactions(items: Transaction[]): Transaction[] {
  const activeIds = activeMockAccountIds();
  return items.filter((tx) => activeIds.has(tx.accountId));
}

function computeMockSummary(from?: string, to?: string): TransactionSummary {
  let items = filterMockTransactions(mockTransactionItems);
  if (from && to) {
    items = items.filter((tx) => tx.date >= from && tx.date <= to);
  } else {
    const month = monthFromDateRange(from, to);
    if (month) {
      items = items.filter((tx) => transactionMatchesMonth(tx.date, month));
    }
  }

  if (items.length === 0) {
    return { ...EMPTY_SUMMARY };
  }

  let totalSpent = 0;
  let income = 0;
  let ccPaymentsExcluded = 0;
  let pendingCount = 0;
  let transactionCount = 0;
  const categoryTotals = new Map<string, number>();

  for (const tx of items) {
    if (tx.pending) {
      pendingCount += 1;
      continue;
    }
    const amount = Math.abs(Number.parseFloat(tx.amount));
    if (
      tx.transactionType === "expense" &&
      !tx.isTransfer &&
      tx.category !== INTERNAL_TRANSFER_CATEGORY
    ) {
      totalSpent += amount;
      transactionCount += 1;
      categoryTotals.set(
        tx.category,
        (categoryTotals.get(tx.category) ?? 0) + amount,
      );
    } else if (tx.transactionType === "income" && !tx.isTransfer) {
      income += amount;
    } else if (
      tx.isTransfer &&
      tx.category === INTERNAL_TRANSFER_CATEGORY &&
      tx.subCategory === CREDIT_CARD_PAYMENT_SUBCATEGORY
    ) {
      ccPaymentsExcluded += amount;
    }
  }

  const net = income - totalSpent;
  let topCategory = { name: "None", amount: "0.00" };
  for (const [name, amount] of categoryTotals) {
    if (
      topCategory.name === "None" ||
      amount > Number.parseFloat(topCategory.amount)
    ) {
      topCategory = { name, amount: amount.toFixed(2) };
    }
  }

  return {
    totalSpent: totalSpent.toFixed(2),
    income: income.toFixed(2),
    netSavings: net.toFixed(2),
    avgMonthlySpend: totalSpent.toFixed(2),
    topCategory,
    ccPaymentsExcluded: ccPaymentsExcluded.toFixed(2),
    savingsRate:
      income > 0 ? Math.round((net / income) * 10000) / 10000 : 0,
    transactionCount,
    pendingCount,
    monthsInPeriod: 1,
  };
}

function syncMockHouseholdAccounts(): void {
  mockHouseholdState.accounts = mockAccounts.map((account, index) => ({
    accountId: account.id,
    name: account.name,
    mask: account.mask ?? "0000",
    institutionName: account.institutionName,
    balanceCurrent: account.balanceCurrent,
    memberId: index % 2 === 0 ? "mock-member-owner" : "mock-member-partner",
    memberName: index % 2 === 0 ? "Me" : "Partner",
    memberColor: index % 2 === 0 ? "#7c3aed" : "#ec4899",
  }));
}

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, MOCK_DELAY_MS);
  });
}

function monthFromDateRange(from?: string, to?: string): string | undefined {
  if (from) {
    return from.slice(0, 7);
  }
  if (to) {
    return to.slice(0, 7);
  }
  return undefined;
}

function transactionMatchesMonth(date: string, month?: string): boolean {
  if (!month) {
    return true;
  }
  return date.startsWith(month);
}

export async function getSummary(
  from?: string,
  to?: string,
): Promise<TransactionSummary> {
  await delay();
  if (mockDataMutated) {
    return computeMockSummary(from, to);
  }
  return summaryData as TransactionSummary;
}

function normalizeMerchantKey(
  merchantName: string | null | undefined,
  name: string,
): string {
  return (merchantName?.trim() || name.trim()).toLowerCase().replace(/\s+/g, " ");
}

export async function updateTransactionCategory(
  transactionId: string,
  category: string,
  subCategory: string | null,
  rememberForMerchant: boolean,
): Promise<UpdateTransactionCategoryResponse> {
  await delay();
  const items = (transactionsData as PaginatedTransactions).items;
  const txn = items.find((row) => row.id === transactionId);
  if (!txn) {
    throw new Error("Transaction not found");
  }

  const merchantKey = normalizeMerchantKey(txn.merchantName, txn.name);
  let merchantTransactionsUpdated = 0;

  if (rememberForMerchant) {
    for (const row of items) {
      if (normalizeMerchantKey(row.merchantName, row.name) === merchantKey) {
        row.category = category;
        row.subCategory = subCategory;
        merchantTransactionsUpdated++;
      }
    }
  } else {
    txn.category = category;
    txn.subCategory = subCategory;
    merchantTransactionsUpdated = 1;
  }

  return {
    transaction: { id: transactionId, category, subCategory, merchantKey },
    merchantTransactionsUpdated,
  };
}

export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<PaginatedTransactions> {
  await delay();

  const {
    month,
    category,
    subCategory,
    categorizationStatus,
    accountId,
    q,
    type,
    sort = "date_desc",
    limit = 50,
    cursor,
  } = filters;

  const accountMasks = new Map(
    mockAccounts.map((account) => [account.id, account.mask]),
  );

  const allItems = filterMockTransactions(mockTransactionItems).map(
    (tx) => ({
      ...tx,
      accountMask: tx.accountMask ?? accountMasks.get(tx.accountId) ?? null,
    }),
  );

  let filtered = allItems.filter((tx) => {
    if (!transactionMatchesMonth(tx.date, month)) {
      return false;
    }
    if (category && tx.category !== category) {
      return false;
    }
    if (subCategory) {
      if (subCategory === "General") {
        if (tx.subCategory != null && tx.subCategory.trim() !== "") {
          return false;
        }
      } else if (tx.subCategory !== subCategory) {
        return false;
      }
    }
    if (categorizationStatus) {
      if (tx.transactionType !== "expense" || tx.isTransfer) {
        return false;
      }
      if (categorizationStatus === "uncategorized") {
        if (tx.category !== "Uncategorized") return false;
      } else if (categorizationStatus === "missing_subcategory") {
        if (tx.category === "Uncategorized") return false;
        if (tx.subCategory != null && tx.subCategory.trim() !== "") {
          return false;
        }
      } else if (categorizationStatus === "needs_review") {
        const needsReview =
          tx.category === "Uncategorized" ||
          tx.subCategory == null ||
          tx.subCategory.trim() === "";
        if (!needsReview) return false;
      }
    }
    if (accountId && tx.accountId !== accountId) {
      return false;
    }
    if (type && tx.transactionType !== type) {
      return false;
    }
    if (q) {
      const query = q.toLowerCase();
      const haystack =
        `${tx.name} ${tx.merchantName ?? ""} ${tx.category}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
      case "date_asc":
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case "amount_desc":
        return Number.parseFloat(b.amount) - Number.parseFloat(a.amount);
      case "amount_asc":
        return Number.parseFloat(a.amount) - Number.parseFloat(b.amount);
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "category_asc":
        return (
          a.category.localeCompare(b.category) ||
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      default:
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
  });

  if (cursor) {
    const cursorIndex = filtered.findIndex((tx) => tx.id === cursor);
    if (cursorIndex >= 0) {
      filtered = filtered.slice(cursorIndex + 1);
    }
  }

  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;

  return { items: page, nextCursor };
}

export async function getAccounts(): Promise<AccountsResponse> {
  await delay();
  return { accounts: [...mockAccounts] };
}

export async function getCreditDebtSummary(): Promise<CreditDebtSummary> {
  await delay();
  const cards = mockAccounts
    .filter((account) => account.type === "credit")
    .map((account) => ({
      accountId: account.id,
      name: account.name,
      mask: account.mask,
      institutionName: account.institutionName,
      balanceCurrent: account.balanceCurrent,
      liability: account.liability ?? null,
    }));

  const num = (v: string | null | undefined): number =>
    v ? Number.parseFloat(v) : 0;
  const withLiability = cards.filter((c) => c.liability);

  return {
    totalCurrentBalance: cards
      .reduce((sum, card) => sum + Number.parseFloat(card.balanceCurrent), 0)
      .toFixed(2),
    totalStatementBalance: cards
      .reduce((s, c) => s + num(c.liability?.lastStatementBalance), 0)
      .toFixed(2),
    totalMinimumDue: cards
      .reduce((s, c) => s + num(c.liability?.minimumPaymentAmount), 0)
      .toFixed(2),
    totalEstimatedMonthlyInterest: cards
      .reduce((s, c) => s + num(c.liability?.estimatedMonthlyInterest), 0)
      .toFixed(2),
    overdueCount: cards.filter((c) => c.liability?.isOverdue).length,
    coverageLabel:
      withLiability.length === cards.length
        ? `Statement data for all ${cards.length} cards`
        : `Statement data for ${withLiability.length} of ${cards.length} cards`,
    cards,
  };
}

export async function deleteAccount(
  accountId: string,
): Promise<import("@/types/api").DeleteAccountResponse> {
  await delay();
  const index = mockAccounts.findIndex((row) => row.id === accountId);
  if (index < 0) {
    throw new Error("Account not found");
  }
  const account = mockAccounts[index];
  if (!account) {
    throw new Error("Account not found");
  }
  mockAccounts.splice(index, 1);
  const transactionsDeleted = mockTransactionItems.filter(
    (tx) => tx.accountId === accountId,
  ).length;
  mockTransactionItems = mockTransactionItems.filter(
    (tx) => tx.accountId !== accountId,
  );
  mockDataMutated = true;
  syncMockHouseholdAccounts();

  const plaidItemDisconnected =
    account.source === "plaid" &&
    !mockAccounts.some(
      (row) =>
        row.source === "plaid" &&
        row.institutionName === account.institutionName,
    );

  return {
    id: account.id,
    name: account.name,
    mask: account.mask ?? "0000",
    transactionsDeleted,
    plaidItemDisconnected,
  };
}

export async function syncAccount(
  accountId: string,
): Promise<import("@/types/api").PlaidSyncResponse> {
  await delay();
  return {
    status: "completed",
    itemId: "mock-item",
    institutionName: "Mock Bank",
    accountsSynced: 1,
    added: 3,
    modified: 0,
    removed: 0,
  };
}

export async function syncAllPlaid(): Promise<
  import("@/types/api").PlaidSyncAllResponse
> {
  await delay();
  return {
    status: "completed",
    itemsSynced: 2,
    added: 5,
    modified: 1,
    removed: 0,
  };
}

export async function getAlerts(_month?: string): Promise<AlertsResponse> {
  await delay();
  return alertsData as AlertsResponse;
}

export async function getCategories(
  _from?: string,
  _to?: string,
): Promise<CategoriesResponse> {
  await delay();
  return categoriesData as CategoriesResponse;
}

export async function getMoneyFlow(
  _from?: string,
  _to?: string,
): Promise<MoneyFlowResponse> {
  await delay();
  const raw = moneyFlowData as Omit<MoneyFlowResponse, "income"> & {
    income: {
      sources:
        | MoneyFlowResponse["income"]["sources"]
        | Array<{ label: string; amount: string }>;
      total: string;
    };
  };
  const sources = Array.isArray(raw.income.sources)
    ? raw.income.sources
    : raw.income.sources.rows;
  return {
    ...raw,
    income: {
      total: raw.income.total,
      sources: mockListPage(sources, "amount"),
    },
  };
}

export async function getTrends(
  from?: string,
  to?: string,
): Promise<TrendsResponse> {
  await delay();

  const fromMonth = monthFromDateRange(from, to);
  const toMonth = to?.slice(0, 7);

  const trends = (trendsData as TrendsResponse).trends.map((trend) => ({
    ...trend,
    months: trend.months.filter((point) => {
      if (fromMonth && point.month < fromMonth) {
        return false;
      }
      if (toMonth && point.month > toMonth) {
        return false;
      }
      return true;
    }),
  }));

  return { trends };
}

export async function getChartData(params: {
  from?: string;
  to?: string;
  accountId?: string;
  category?: string;
}): Promise<ChartDataResponse> {
  await delay();

  const accountNames = new Map(mockAccounts.map((a) => [a.id, a.name]));

  const scopedItems = filterMockTransactions(mockTransactionItems).filter(
    (tx) => {
      if (params.accountId && tx.accountId !== params.accountId) return false;
      if (params.category && tx.category !== params.category) return false;
      return true;
    },
  );

  let items = scopedItems.filter((tx) => {
    if (params.from && tx.date < params.from) return false;
    if (params.to && tx.date > params.to) return false;
    return true;
  });

  const monthlyMap = new Map<
    string,
    { expenses: number; income: number; net: number }
  >();
  const yearlyMap = new Map<
    string,
    { expenses: number; income: number; net: number }
  >();
  const categoryMap = new Map<string, number>();
  const accountMap = new Map<string, number>();
  const trendMap = new Map<string, Map<string, number>>();

  for (const tx of items) {
    const month = tx.date.slice(0, 7);
    const entry = monthlyMap.get(month) ?? { expenses: 0, income: 0, net: 0 };
    const amount = Number.parseFloat(tx.amount);

    if (tx.transactionType === "expense" && !tx.isTransfer) {
      entry.expenses += amount;
      entry.net -= amount;
      categoryMap.set(tx.category, (categoryMap.get(tx.category) ?? 0) + amount);
      accountMap.set(tx.accountId, (accountMap.get(tx.accountId) ?? 0) + amount);

      const catTrend = trendMap.get(tx.category) ?? new Map<string, number>();
      catTrend.set(month, (catTrend.get(month) ?? 0) + amount);
      trendMap.set(tx.category, catTrend);
    } else if (tx.transactionType === "income" && !tx.isTransfer) {
      entry.income += Math.abs(amount);
      entry.net += Math.abs(amount);
    }

    monthlyMap.set(month, entry);
  }

  for (const tx of scopedItems) {
    const year = tx.date.slice(0, 4);
    const entry = yearlyMap.get(year) ?? { expenses: 0, income: 0, net: 0 };
    const amount = Number.parseFloat(tx.amount);

    if (tx.transactionType === "expense" && !tx.isTransfer) {
      entry.expenses += amount;
      entry.net -= amount;
    } else if (tx.transactionType === "income" && !tx.isTransfer) {
      entry.income += Math.abs(amount);
      entry.net += Math.abs(amount);
    }

    yearlyMap.set(year, entry);
  }

  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      month,
      expenses: values.expenses.toFixed(2),
      income: values.income.toFixed(2),
      net: values.net.toFixed(2),
    }));

  const categoryTotal = [...categoryMap.values()].reduce((s, v) => s + v, 0);
  const accountTotal = [...accountMap.values()].reduce((s, v) => s + v, 0);

  const byCategory = [...categoryMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => ({
      name,
      amount: amount.toFixed(2),
      percentage: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
    }));

  const byAccount = [...accountMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([id, amount]) => ({
      id,
      name: accountNames.get(id) ?? "Account",
      amount: amount.toFixed(2),
      percentage: accountTotal > 0 ? (amount / accountTotal) * 100 : 0,
    }));

  const categoryTrends = [...trendMap.entries()]
    .sort(([, a], [, b]) => {
      const totalA = [...a.values()].reduce((s, v) => s + v, 0);
      const totalB = [...b.values()].reduce((s, v) => s + v, 0);
      return totalB - totalA;
    })
    .slice(0, params.category ? 1 : 5)
    .map(([name, monthsMap]) => ({
      name,
      months: [...monthsMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({
          month,
          amount: amount.toFixed(2),
        })),
    }));

  const expenseTotal = monthly.reduce(
    (s, row) => s + Number.parseFloat(row.expenses),
    0,
  );
  const incomeTotal = monthly.reduce(
    (s, row) => s + Number.parseFloat(row.income),
    0,
  );

  const yearly =
    yearlyMap.size > 1
      ? [...yearlyMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([year, values]) => ({
            year,
            expenses: values.expenses.toFixed(2),
            income: values.income.toFixed(2),
            net: values.net.toFixed(2),
          }))
      : [];

  return {
    monthly,
    yearly,
    byCategory,
    bySubCategory: [],
    byAccount,
    byMember: byCategory.map((slice, index) => ({
      id: `mock-member-${index}`,
      name: index === 0 ? "Me" : `Member ${index + 1}`,
      color: ["#7c3aed", "#ec4899", "#14b8a6"][index % 3] ?? "#7c3aed",
      amount: slice.amount,
      percentage: slice.percentage,
    })),
    categoryTrends,
    totals: {
      expenses: expenseTotal.toFixed(2),
      income: incomeTotal.toFixed(2),
      net: (incomeTotal - expenseTotal).toFixed(2),
    },
  };
}

const mockHouseholdState: HouseholdResponse = {
  accessRole: "owner",
  household: {
    id: "mock-household",
    name: "My Family",
    createdAt: new Date().toISOString(),
  },
  members: [
    {
      id: "mock-member-owner",
      displayName: "Me",
      role: "owner",
      avatarColor: "#7c3aed",
      userId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "mock-member-partner",
      displayName: "Partner",
      role: "partner",
      avatarColor: "#ec4899",
      userId: null,
      createdAt: new Date().toISOString(),
    },
  ],
  accounts: INITIAL_MOCK_ACCOUNTS.map((account, index) => ({
    accountId: account.id,
    name: account.name,
    mask: account.mask ?? "0000",
    institutionName: account.institutionName,
    balanceCurrent: account.balanceCurrent,
    memberId: index % 2 === 0 ? "mock-member-owner" : "mock-member-partner",
    memberName: index % 2 === 0 ? "Me" : "Partner",
    memberColor: index % 2 === 0 ? "#7c3aed" : "#ec4899",
  })),
};

export async function getHousehold(): Promise<HouseholdResponse> {
  await delay();
  return mockHouseholdState;
}

export async function updateHouseholdName(name: string) {
  await delay();
  mockHouseholdState.household.name = name;
  return { id: mockHouseholdState.household.id, name };
}

export async function getHouseholdInsights(
  from?: string,
  to?: string,
): Promise<HouseholdInsightsResponse> {
  await delay();
  const year = new Date().getFullYear();
  const period =
    from && to
      ? { from, to }
      : { from: `${year}-01-01`, to: `${year}-12-31` };
  return {
    members: mockHouseholdState.members.map((member) => ({
      memberId: member.id,
      displayName: member.displayName,
      role: member.role,
      avatarColor: member.avatarColor,
      accountCount: mockHouseholdState.accounts.filter(
        (account) => account.memberId === member.id,
      ).length,
      totalSpent: "2450.00",
      totalIncome: "5200.00",
      topCategory: { name: "Food & Groceries", amount: "680.00" },
    })),
    unassignedAccounts: mockHouseholdState.accounts.filter(
      (account) => !account.memberId,
    ),
    householdTotals: {
      expenses: "4900.00",
      income: "10400.00",
      net: "5500.00",
    },
    period,
  };
}

export async function createHouseholdMember(input: {
  displayName: string;
  role: "partner" | "child" | "other";
}): Promise<HouseholdMember> {
  await delay();
  const member: HouseholdMember = {
    id: `mock-member-${Date.now()}`,
    displayName: input.displayName,
    role: input.role,
    avatarColor: "#14b8a6",
    userId: null,
    createdAt: new Date().toISOString(),
  };
  mockHouseholdState.members.push(member);
  return member;
}

export async function updateHouseholdMember(
  memberId: string,
  input: { displayName?: string; role?: HouseholdMember["role"] },
): Promise<HouseholdMember> {
  await delay();
  const member = mockHouseholdState.members.find((row) => row.id === memberId);
  if (!member) throw new Error("Member not found");
  if (input.displayName) member.displayName = input.displayName;
  if (input.role) member.role = input.role;
  return member;
}

export async function deleteHouseholdMember(memberId: string) {
  await delay();
  mockHouseholdState.members = mockHouseholdState.members.filter(
    (member) => member.id !== memberId,
  );
  mockHouseholdState.accounts = mockHouseholdState.accounts.map((account) =>
    account.memberId === memberId
      ? { ...account, memberId: null, memberName: null, memberColor: null }
      : account,
  );
  return { status: "deleted" };
}

export async function assignAccountToMember(
  accountId: string,
  memberId: string,
) {
  await delay();
  const member = mockHouseholdState.members.find((row) => row.id === memberId);
  mockHouseholdState.accounts = mockHouseholdState.accounts.map((account) =>
    account.accountId === accountId
      ? {
          ...account,
          memberId,
          memberName: member?.displayName ?? null,
          memberColor: member?.avatarColor ?? null,
        }
      : account,
  );
  return { accountId, memberId };
}

export async function inviteHouseholdMember(
  memberId: string,
  email: string,
) {
  await delay();
  const member = mockHouseholdState.members.find((row) => row.id === memberId);
  if (!member) throw new Error("Member not found");
  const inviteUrl = `http://localhost:3002/accept-invite?token=mock-invite-token`;
  member.pendingInvite = {
    id: "mock-invite",
    email: email.trim().toLowerCase(),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "pending",
  };
  return {
    invitationId: "mock-invite",
    inviteUrl,
    expiresAt: member.pendingInvite.expiresAt,
    email: member.pendingInvite.email,
  };
}

export async function revokeHouseholdInvite(memberId: string) {
  await delay();
  const member = mockHouseholdState.members.find((row) => row.id === memberId);
  if (member) member.pendingInvite = null;
  return { status: "revoked" };
}

export async function previewHouseholdInvite(token: string) {
  await delay();
  void token;
  return {
    householdName: mockHouseholdState.household.name,
    memberName: "Partner",
    memberRole: "partner",
    email: "partner@example.com",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    status: "pending" as const,
  };
}

export async function acceptHouseholdInvite(token: string) {
  await delay();
  void token;
  const partner = mockHouseholdState.members.find((m) => m.role === "partner");
  if (partner) partner.userId = "mock-partner-user";
  return {
    householdId: mockHouseholdState.household.id,
    householdName: mockHouseholdState.household.name,
    memberId: partner?.id ?? "mock-member-partner",
    memberDisplayName: partner?.displayName ?? "Partner",
  };
}

/* ------------------------------------------------------------------ *
 * Feature endpoints (demo dataset) — wealth, planning, insights,
 * protect, coach & wrapped. These mirror the backend /api/v1 routes.
 * ------------------------------------------------------------------ */

function mockFireProjection(input: {
  currentAge: number;
  currentNetWorth: number;
  monthlySpend: number;
  monthlyInvest: number;
  withdrawalRate: number;
  realReturn: number;
}): FireProjection {
  const fireNumber =
    input.withdrawalRate > 0
      ? (input.monthlySpend * 12) / (input.withdrawalRate / 100)
      : 0;
  let balance = input.currentNetWorth;
  const monthlyReturn = input.realReturn / 100 / 12;
  let months = 0;
  while (balance < fireNumber && months < 1200) {
    balance = balance * (1 + monthlyReturn) + input.monthlyInvest;
    months += 1;
  }
  const yearsToFire = months / 12;
  const curve: number[] = [];
  balance = input.currentNetWorth;
  const cap = Math.min(Math.ceil(yearsToFire) + 2, 45);
  for (let y = 0; y <= cap; y++) {
    curve.push(Math.round(balance));
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyReturn) + input.monthlyInvest;
    }
  }
  const cashFlow = input.monthlySpend + input.monthlyInvest;
  return {
    fireNumber: fireNumber.toFixed(2),
    yearsToFire: Math.round(yearsToFire * 100) / 100,
    fireAge: Math.round((input.currentAge + yearsToFire) * 10) / 10,
    investingRate:
      cashFlow > 0
        ? Math.round((input.monthlyInvest / cashFlow) * 1000) / 10
        : 0,
    curve,
  };
}

function mockIncomeSummary(income: {
  months: string[];
  primary: number[];
  side: number[];
}) {
  const totalIncome =
    income.primary.reduce((a, b) => a + b, 0) +
    income.side.reduce((a, b) => a + b, 0);
  const avgMonthlyIncome =
    income.months.length > 0 ? totalIncome / income.months.length : 0;
  const mean =
    income.primary.reduce((a, b) => a + b, 0) / (income.primary.length || 1);
  const variance =
    income.primary.reduce((s, v) => s + (v - mean) ** 2, 0) /
    (income.primary.length || 1);
  const stability =
    mean > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((1 - Math.sqrt(variance) / mean) * 100)),
        )
      : 0;
  const maxBarTotal = Math.max(
    ...income.primary.map((v, i) => v + (income.side[i] ?? 0)),
    1,
  );
  return {
    avgMonthlyIncome: avgMonthlyIncome.toFixed(2),
    incomeStability: stability,
    sideIncomeTotal: income.side.reduce((a, b) => a + b, 0).toFixed(2),
    chartYTicks: [0, maxBarTotal / 2, maxBarTotal].map((v) => Math.round(v)),
    maxBarTotal: Math.round(maxBarTotal),
  };
}

function mockTimeMachine(
  habits: Array<{ id: string; emoji: string | null; label: string; monthly: string }>,
) {
  const lookbackYears = 3;
  const investMultiple = 1.45;
  return {
    lookbackYears,
    investMultiple,
    investMultipleBasis: "heuristic" as const,
    futureCompoundRate: 0.07,
    futureYears: 20,
    habits: habits.map((habit) => {
      const monthly = Number.parseFloat(habit.monthly);
      const spent = Math.round(monthly * 12 * lookbackYears * 100) / 100;
      return {
        id: habit.id,
        emoji: habit.emoji,
        label: habit.label,
        spent: spent.toFixed(2),
        investedValue: (spent * investMultiple).toFixed(2),
        yearsAgo: lookbackYears,
      };
    }),
  };
}

function buildMockFireResponse(
  base: Omit<FireResponse, "projection"> & { projection?: FireProjection },
  overrides: FireQueryOverrides = {},
): FireResponse {
  const monthlySpend =
    overrides.monthlySpend ?? Number.parseFloat(base.monthlySpend);
  const monthlyInvest =
    overrides.monthlyInvest ?? Number.parseFloat(base.monthlyInvest);
  const withdrawalRate = overrides.withdrawalRate ?? base.withdrawalRate;
  const realReturn = overrides.realReturn ?? base.realReturn;
  return {
    ...base,
    monthlySpend: monthlySpend.toFixed(2),
    monthlyInvest: monthlyInvest.toFixed(2),
    withdrawalRate,
    realReturn,
    projection: mockFireProjection({
      currentAge: base.currentAge,
      currentNetWorth: Number.parseFloat(base.currentNetWorth),
      monthlySpend,
      monthlyInvest,
      withdrawalRate,
      realReturn,
    }),
  };
}

export async function getNetWorth(): Promise<NetWorthResponse> {
  await delay();
  const raw = netWorthData as NetWorthResponse;
  return {
    ...raw,
    current: {
      ...raw.current,
      accountCount: raw.current.accountCount ?? 6,
    },
    breakdown: raw.breakdown ?? {
      depository: { total: "45200.00", accountCount: 2 },
      investment: { total: raw.current.totalAssets, accountCount: 2 },
      credit: { total: raw.current.totalLiabilities, accountCount: 2 },
    },
  };
}

const EMPTY_PORTFOLIO_ANALYTICS: InvestmentsResponse["portfolioAnalytics"] = {
  winners: { count: 0, value: "0.00", sharePercent: 0 },
  losers: { count: 0, value: "0.00", sharePercent: 0 },
  winRate: 0,
  bestPerformer: null,
  worstPerformer: null,
  bestPerformerByDollar: null,
  worstPerformerByDollar: null,
  concentration: { largestPositionWeight: 0, top5Weight: 0, hhi: 0 },
  sectorAllocation: [],
  unrealizedProfit: { total: "0.00", positionCount: 0 },
  unrealizedLoss: { total: "0.00", positionCount: 0 },
  costBasisCompleteness: { scored: 0, total: 0, percent: 0 },
  caveats: [],
};

const EMPTY_PRUNE_LOSERS: InvestmentsResponse["pruneLosers"] = {
  available: false,
  confidence: 0,
  caveats: [],
  cutCandidates: [],
  holdRecover: [],
  whatIf: null,
};

async function buildMockInvestmentsResponse(
  params: ListQuery = {},
): Promise<InvestmentsResponse> {
  const data = investmentsData as InvestmentsResponse & {
    positions?: InvestmentsResponse["positions"] | InvestmentPosition[];
    holdings?: InvestmentsResponse["holdings"] | InvestmentsResponse["holdings"]["rows"];
  };
  const legacyHoldings = Array.isArray(data.holdings)
    ? data.holdings
    : data.holdings.rows;
  const legacyPositions = Array.isArray(data.positions)
    ? data.positions
    : data.positions.rows;

  const positionSortKeys: Record<
    string,
    (row: InvestmentPosition) => number | string
  > = {
    ticker: (r) => r.ticker.toLowerCase(),
    name: (r) => r.name.toLowerCase(),
    value: (r) => Number.parseFloat(r.value),
    gainLoss: (r) => Number.parseFloat(r.gainLoss),
    gainLossPercent: (r) => r.gainLossPercent,
    costBasis: (r) => Number.parseFloat(r.costBasis),
  };

  if (legacyPositions.length > 0) {
    const positionsPage = paginateMockRows(
      legacyPositions,
      params,
      positionSortKeys,
      "value",
      (row, needle) =>
        row.ticker.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle),
    );
    return {
      ...data,
      portfolioAnalytics: data.portfolioAnalytics ?? EMPTY_PORTFOLIO_ANALYTICS,
      portfolioValueTrend: data.portfolioValueTrend ?? {
        points: [],
        granularity: "monthly",
        caveats: [],
      },
      pruneLosers: data.pruneLosers ?? EMPTY_PRUNE_LOSERS,
      positions: positionsPage,
      holdings: {
        ...positionsPage,
        rows: positionsPage.rows.map((p) => ({
          ticker: p.ticker,
          name: p.name,
          sector: p.sector,
          assetType: p.assetType,
          quantity: p.quantity,
          costBasis: p.costBasis,
          currentPrice: p.currentPrice,
          value: p.value,
          gainLoss: p.gainLoss,
          gainLossPercent: p.gainLossPercent,
          underlyingTicker: p.underlyingTicker,
          optionType: p.optionType,
          expirationLabel: p.expirationLabel,
        })),
      },
    };
  }

  const accountByTicker: Record<string, string> = {
    AAPL: "a1b2c3d4-e5f6-4789-a012-345678901007",
    VOO: "a1b2c3d4-e5f6-4789-a012-345678901007",
    MSFT: "a1b2c3d4-e5f6-4789-a012-345678901007",
    TSLA: "a1b2c3d4-e5f6-4789-a012-345678901007",
    AMZN: "a1b2c3d4-e5f6-4789-a012-345678901007",
    VTI: "a1b2c3d4-e5f6-4789-a012-345678901008",
    VXUS: "a1b2c3d4-e5f6-4789-a012-345678901008",
    FXAIX: "a1b2c3d4-e5f6-4789-a012-345678901009",
    VBTLX: "a1b2c3d4-e5f6-4789-a012-345678901009",
    BTC: "a1b2c3d4-e5f6-4789-a012-345678901010",
    ETH: "a1b2c3d4-e5f6-4789-a012-345678901010",
  };

  const accountsById = new Map(
    data.accounts.map((a) => [a.accountId, a]),
  );

  const positions: InvestmentPosition[] = legacyHoldings.map((h, index) => {
    const accountId =
      accountByTicker[h.ticker] ?? data.accounts[0]?.accountId ?? "mock-account";
    const account = accountsById.get(accountId);
    return {
      holdingId: `mock-holding-${index}`,
      accountId,
      accountName: account?.name ?? "Investment account",
      institutionName: account?.institutionName ?? "",
      accountMask: null,
      ticker: h.ticker,
      name: h.name,
      sector: h.sector,
      assetType: h.assetType,
      quantity: h.quantity,
      costBasis: h.costBasis,
      currentPrice: h.currentPrice,
      value: h.value,
      gainLoss: h.gainLoss,
      gainLossPercent: h.gainLossPercent,
      underlyingTicker: h.underlyingTicker,
      optionType: h.optionType,
      expirationLabel: h.expirationLabel,
    };
  });

  const stockAggregates: StockAggregate[] = legacyHoldings
    .filter((h) => h.assetType !== "option")
    .map((h) => {
      const accountId =
        accountByTicker[h.ticker] ?? data.accounts[0]?.accountId ?? "mock-account";
      const account = accountsById.get(accountId);
      const totalCost = (h.quantity * Number.parseFloat(h.costBasis)).toFixed(2);
      return {
        ticker: h.ticker,
        name: h.name,
        sector: h.sector,
        assetType: h.assetType,
        totalQuantity: h.quantity,
        currentPrice: h.currentPrice,
        totalValue: h.value,
        totalCost,
        gainLoss: h.gainLoss,
        gainLossPercent: h.gainLossPercent,
        accountCount: 1,
        lots: [
          {
            accountId,
            accountName: account?.name ?? "Investment account",
            quantity: h.quantity,
            value: h.value,
            costBasis: h.costBasis,
          },
        ],
      };
    });

  const optionPositions = positions.filter((p) => p.assetType === "option");

  const positionsPage = paginateMockRows(
    positions,
    params,
    positionSortKeys,
    "value",
    (row, needle) =>
      row.ticker.toLowerCase().includes(needle) ||
      row.name.toLowerCase().includes(needle),
  );

  return {
    ...data,
    portfolioAnalytics: data.portfolioAnalytics ?? EMPTY_PORTFOLIO_ANALYTICS,
    portfolioValueTrend: data.portfolioValueTrend ?? {
      points: [],
      granularity: "monthly",
      caveats: [],
    },
    pruneLosers: data.pruneLosers ?? EMPTY_PRUNE_LOSERS,
    positions: positionsPage,
    holdings: {
      ...positionsPage,
      rows: positionsPage.rows.map((p) => ({
        ticker: p.ticker,
        name: p.name,
        sector: p.sector,
        assetType: p.assetType,
        quantity: p.quantity,
        costBasis: p.costBasis,
        currentPrice: p.currentPrice,
        value: p.value,
        gainLoss: p.gainLoss,
        gainLossPercent: p.gainLossPercent,
        underlyingTicker: p.underlyingTicker,
        optionType: p.optionType,
        expirationLabel: p.expirationLabel,
      })),
    },
    stockAggregates,
    optionPositions,
  };
}

export async function getInvestments(
  params: ListQuery = {},
): Promise<InvestmentsResponse> {
  await delay();
  return buildMockInvestmentsResponse(params);
}

let mockBudgetsState: BudgetsResponse = {
  ...(budgetsData as BudgetsResponse),
  isLive: false,
};

function nextMockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export async function getBudgets(): Promise<BudgetsResponse> {
  await delay();
  return { ...mockBudgetsState };
}

export async function upsertBudget(body: UpsertBudgetInput): Promise<BudgetRow> {
  await delay();
  const limit = body.limit.toFixed(2);
  const existingIdx = mockBudgetsState.budgets.findIndex(
    (b) => b.category === body.category,
  );
  const row: BudgetRow = {
    id: existingIdx >= 0 ? mockBudgetsState.budgets[existingIdx]!.id! : nextMockId("budget"),
    category: body.category,
    periodMonth: body.periodMonth,
    emoji: body.emoji ?? "💸",
    color: body.color ?? "#3b82f6",
    limit,
    source: body.source ?? "user",
    class: body.class ?? null,
  };
  const item = {
    id: row.id,
    category: row.category,
    emoji: row.emoji,
    color: row.color,
    spent: existingIdx >= 0 ? mockBudgetsState.budgets[existingIdx]!.spent : "0.00",
    limit: row.limit,
    source: row.source,
    class: row.class,
  };
  if (existingIdx >= 0) {
    mockBudgetsState.budgets[existingIdx] = item;
  } else {
    mockBudgetsState.budgets.push(item);
  }
  mockBudgetsState.suggestedBudgets = mockBudgetsState.suggestedBudgets.filter(
    (s) => s.category !== body.category,
  );
  return row;
}

export async function patchBudget(
  budgetId: string,
  body: PatchBudgetInput,
): Promise<BudgetRow> {
  await delay();
  const idx = mockBudgetsState.budgets.findIndex((b) => b.id === budgetId);
  if (idx < 0) throw new Error("Budget not found");
  const current = mockBudgetsState.budgets[idx]!;
  const limit = body.limit != null ? body.limit.toFixed(2) : current.limit;
  mockBudgetsState.budgets[idx] = {
    ...current,
    limit,
    emoji: body.emoji !== undefined ? body.emoji : current.emoji,
    color: body.color !== undefined ? body.color : current.color,
    class: body.class !== undefined ? body.class : current.class,
  };
  return {
    id: budgetId,
    category: current.category,
    periodMonth: mockBudgetsState.periodMonth,
    emoji: mockBudgetsState.budgets[idx]!.emoji,
    color: mockBudgetsState.budgets[idx]!.color,
    limit,
    source: current.source,
    class: mockBudgetsState.budgets[idx]!.class ?? null,
  };
}

export async function deleteBudget(budgetId: string): Promise<{ id: string }> {
  await delay();
  mockBudgetsState.budgets = mockBudgetsState.budgets.filter((b) => b.id !== budgetId);
  return { id: budgetId };
}

export async function createGoal(body: CreateGoalInput): Promise<GoalRow> {
  await delay();
  const row: GoalRow = {
    id: nextMockId("goal"),
    name: body.name,
    emoji: body.emoji ?? "🎯",
    color: body.color ?? "#22c55e",
    target: body.target.toFixed(2),
    current: (body.current ?? 0).toFixed(2),
    deadline: body.deadline ?? null,
    kind: body.kind ?? "custom",
    status: body.status ?? "active",
    source: body.source ?? "user",
    accountId: body.accountId ?? null,
  };
  if (row.status === "dismissed") {
    mockBudgetsState.suggestedGoals = mockBudgetsState.suggestedGoals.filter(
      (g) => g.name.toLowerCase() !== row.name.toLowerCase() || g.kind !== row.kind,
    );
    return row;
  }
  mockBudgetsState.goals.push({
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    target: row.target,
    current: row.current,
    deadline: row.deadline,
    kind: row.kind,
    status: row.status,
    source: row.source,
    accountId: row.accountId,
  });
  mockBudgetsState.suggestedGoals = mockBudgetsState.suggestedGoals.filter(
    (g) => g.name.toLowerCase() !== row.name.toLowerCase() || g.kind !== row.kind,
  );
  return row;
}

export async function patchGoal(goalId: string, body: PatchGoalInput): Promise<GoalRow> {
  await delay();
  const idx = mockBudgetsState.goals.findIndex((g) => g.id === goalId);
  if (idx < 0) throw new Error("Savings goal not found");
  const current = mockBudgetsState.goals[idx]!;
  const updated = {
    ...current,
    name: body.name ?? current.name,
    target: body.target != null ? body.target.toFixed(2) : current.target,
    current: body.current != null ? body.current.toFixed(2) : current.current,
    deadline: body.deadline !== undefined ? body.deadline : current.deadline,
    emoji: body.emoji !== undefined ? body.emoji : current.emoji,
    color: body.color !== undefined ? body.color : current.color,
    kind: body.kind ?? current.kind,
    status: body.status ?? current.status,
    accountId: body.accountId !== undefined ? body.accountId : current.accountId,
  };
  mockBudgetsState.goals[idx] = updated;
  return {
    id: goalId,
    name: updated.name,
    emoji: updated.emoji,
    color: updated.color,
    target: updated.target,
    current: updated.current,
    deadline: updated.deadline,
    kind: updated.kind,
    status: updated.status,
    source: updated.source,
    accountId: updated.accountId ?? null,
  };
}

export async function deleteGoal(goalId: string): Promise<{ id: string }> {
  await delay();
  mockBudgetsState.goals = mockBudgetsState.goals.filter((g) => g.id !== goalId);
  return { id: goalId };
}

export async function getRecurring(
  params: ListQuery = {},
): Promise<RecurringResponse> {
  await delay();
  const raw = recurringData as Omit<RecurringResponse, "subscriptions" | "bills"> & {
    subscriptions: RecurringResponse["subscriptions"] | RecurringResponse["subscriptions"]["rows"];
    bills: RecurringResponse["bills"] | RecurringResponse["bills"]["rows"];
  };
  const subscriptions = Array.isArray(raw.subscriptions)
    ? raw.subscriptions
    : raw.subscriptions.rows;
  const bills = Array.isArray(raw.bills) ? raw.bills : raw.bills.rows;
  const activeSubscriptions = subscriptions.filter((s) => s.status !== "lapsed");
  const monthlyTotal = activeSubscriptions.reduce(
    (sum, s) => sum + Number.parseFloat(s.amount),
    0,
  );
  const recurringSortKeys: Record<
    string,
    (row: RecurringResponse["subscriptions"]["rows"][number]) => number | string
  > = {
    merchantName: (r) => r.merchantName.toLowerCase(),
    amount: (r) => Number.parseFloat(r.amount),
    category: (r) => r.category.toLowerCase(),
    nextChargeDate: (r) => r.nextChargeDate ?? "",
    status: (r) => r.status,
  };
  return {
    ...raw,
    monthlyTotal: monthlyTotal.toFixed(2),
    annualTotal: (monthlyTotal * 12).toFixed(2),
    activeCount: activeSubscriptions.length,
    priceChanges: activeSubscriptions.filter((s) => s.priceChanged).length,
    subscriptions: paginateMockRows(
      subscriptions,
      params,
      recurringSortKeys,
      "amount",
      (row, needle) =>
        row.merchantName.toLowerCase().includes(needle) ||
        row.category.toLowerCase().includes(needle),
    ),
    bills: mockListPage(bills, "amount"),
    timeMachine: mockTimeMachine(raw.leaks?.habits ?? []),
    isLive: false,
  };
}

let mockFireState: FireResponse = buildMockFireResponse({
  ...(fireData as Omit<FireResponse, "projection">),
  isDefaultAge: false,
});

let mockUserProfile: UserProfileResponse = {
  user: {
    id: "mock-user",
    email: "demo@spendflow.app",
    displayName: "Demo User",
    createdAt: new Date().toISOString(),
  },
  currentAge: mockFireState.currentAge,
  isDefaultAge: mockFireState.isDefaultAge ?? false,
  householdSize: 2,
  annualGrossIncome: "120000.00",
  targetRetirementAge: 55,
  employmentStatus: "employed",
  riskTolerance: "moderate",
  withdrawalRate: mockFireState.withdrawalRate,
  realReturn: mockFireState.realReturn,
  hasLinkedAccounts: true,
  currentNetWorth: mockFireState.currentNetWorth,
  monthlySpend: mockFireState.monthlySpend,
  monthlyInvest: mockFireState.monthlyInvest,
};

let mockAnalyticsProfile: AnalyticsProfileResponse = {
  currentAge: mockUserProfile.currentAge,
  isDefaultAge: mockUserProfile.isDefaultAge,
  householdSize: mockUserProfile.householdSize,
  annualGrossIncome: mockUserProfile.annualGrossIncome,
  targetRetirementAge: mockUserProfile.targetRetirementAge,
  employmentStatus: mockUserProfile.employmentStatus,
  riskTolerance: mockUserProfile.riskTolerance,
  withdrawalRate: mockUserProfile.withdrawalRate,
  realReturn: mockUserProfile.realReturn,
  hasLinkedAccounts: mockUserProfile.hasLinkedAccounts,
  currentNetWorth: mockUserProfile.currentNetWorth,
  monthlySpend: mockUserProfile.monthlySpend,
  monthlyInvest: mockUserProfile.monthlyInvest,
};

export async function getUserProfile(): Promise<UserProfileResponse> {
  await delay();
  return mockUserProfile;
}

export async function patchUserProfile(
  patch: UserProfilePatch,
): Promise<UserProfileResponse> {
  await delay();
  mockUserProfile = {
    ...mockUserProfile,
    ...patch,
    user: {
      ...mockUserProfile.user,
      displayName:
        patch.displayName != null
          ? patch.displayName
          : mockUserProfile.user.displayName,
    },
    annualGrossIncome:
      patch.annualGrossIncome !== undefined
        ? patch.annualGrossIncome == null
          ? null
          : patch.annualGrossIncome.toFixed(2)
        : mockUserProfile.annualGrossIncome,
    isDefaultAge:
      patch.currentAge != null ? false : mockUserProfile.isDefaultAge,
  };
  const { user: _user, ...analytics } = mockUserProfile;
  mockAnalyticsProfile = analytics;
  mockFireState = {
    ...mockFireState,
    currentAge: mockUserProfile.currentAge,
    isDefaultAge: mockUserProfile.isDefaultAge,
    withdrawalRate: mockUserProfile.withdrawalRate,
    realReturn: mockUserProfile.realReturn,
  };
  return mockUserProfile;
}

export async function getAnalyticsProfile(): Promise<AnalyticsProfileResponse> {
  await delay();
  return mockAnalyticsProfile;
}

export async function patchAnalyticsProfile(
  patch: FireProfilePatch,
): Promise<AnalyticsProfileResponse> {
  await delay();
  mockAnalyticsProfile = {
    ...mockAnalyticsProfile,
    ...patch,
    isDefaultAge:
      patch.currentAge != null ? false : mockAnalyticsProfile.isDefaultAge,
  };
  mockFireState = {
    ...mockFireState,
    ...patch,
    isDefaultAge: mockAnalyticsProfile.isDefaultAge,
  };
  return mockAnalyticsProfile;
}

export async function getFire(
  overrides: FireQueryOverrides = {},
): Promise<FireResponse> {
  await delay();
  return buildMockFireResponse(mockFireState, overrides);
}

export async function patchFire(patch: FireProfilePatch): Promise<FireResponse> {
  await delay();
  mockFireState = buildMockFireResponse({
    ...mockFireState,
    ...patch,
    isDefaultAge: patch.currentAge != null ? false : mockFireState.isDefaultAge,
  });
  return mockFireState;
}

export async function getWellness(): Promise<WellnessResponse> {
  await delay();
  return { ...(wellnessData as WellnessResponse), isLive: false };
}

export async function getDna(): Promise<DnaResponse> {
  await delay();
  return { ...(dnaData as DnaResponse), isLive: false };
}

export async function getPatterns(): Promise<PatternsResponse> {
  await delay();
  const raw = patternsData as Omit<PatternsResponse, "patterns"> & {
    patterns: PatternsResponse["patterns"] | PatternsResponse["patterns"]["rows"];
  };
  const patterns = Array.isArray(raw.patterns) ? raw.patterns : raw.patterns.rows;
  return {
    dayOfWeek: raw.dayOfWeek,
    patterns: mockListPage(patterns, "value"),
  };
}

export async function getBehavioral(): Promise<BehavioralResponse> {
  await delay();
  return behavioralData as BehavioralResponse;
}

export async function setTransactionReason(
  transactionId: string,
  reasonId: string,
): Promise<{ transactionId: string; reasonId: string | null }> {
  await delay();
  return { transactionId, reasonId };
}

export async function clearTransactionReason(
  transactionId: string,
): Promise<{ transactionId: string; reasonId: string | null }> {
  await delay();
  return { transactionId, reasonId: null };
}

export async function recomputeAnalytics(): Promise<{
  steps: { name: string; status: string }[];
  message?: string;
}> {
  await delay();
  return {
    steps: [
      { name: "marts", status: "ok" },
      { name: "protect", status: "ok" },
      { name: "fire", status: "ok" },
    ],
    message: "Mock analytics recalculated.",
  };
}

export async function getInflation(
  params: ListQuery = {},
): Promise<InflationResponse> {
  await delay();
  const raw = inflationData as Omit<InflationResponse, "categories"> & {
    categories:
      | InflationResponse["categories"]
      | InflationResponse["categories"]["rows"];
  };
  const categories = Array.isArray(raw.categories)
    ? raw.categories
    : raw.categories.rows;
  type CatRow = InflationResponse["categories"]["rows"][number];
  const categorySortKeys: Record<string, (row: CatRow) => number | string> = {
    name: (r) => r.name.toLowerCase(),
    share: (r) => r.share,
    inflation: (r) => r.inflation,
    severity: (r) => r.severity,
  };
  return {
    ...raw,
    categories: paginateMockRows(
      categories,
      params,
      categorySortKeys,
      "share",
      (row, needle) => row.name.toLowerCase().includes(needle),
    ),
  };
}

export async function getResilience(): Promise<ResilienceResponse> {
  await delay();
  return resilienceData as ResilienceResponse;
}

export async function getCoach(): Promise<CoachResponse> {
  await delay();
  return { ...(coachData as CoachResponse), isLive: false };
}

export async function getWrapped(): Promise<WrappedResponse> {
  await delay();
  return wrappedData as WrappedResponse;
}

export async function getMerchants(): Promise<MerchantsResponse> {
  await delay();
  const base = merchantsData as MerchantsResponse;
  const income = base.income ?? { months: [], primary: [], side: [] };
  return {
    ...base,
    income,
    incomeSummary:
      base.incomeSummary ?? mockIncomeSummary(income),
    isLive: false,
  };
}

export async function getMerchantsTable(
  params: ListQuery = {},
): Promise<MerchantsTableResponse> {
  await delay();
  const source = (merchantsData as MerchantsResponse).merchants;
  const grandTotal = source.reduce((s, m) => s + Number.parseFloat(m.total), 0);

  const needle = params.q?.toLowerCase();
  const all: MerchantRow[] = source
    .filter((m) => !needle || m.name.toLowerCase().includes(needle))
    .map((m) => ({
      name: m.name,
      emoji: m.emoji,
      visits: m.visits,
      total: m.total,
      avgTransaction: (Number.parseFloat(m.total) / Math.max(m.visits, 1)).toFixed(2),
      share: grandTotal > 0 ? Math.round((Number.parseFloat(m.total) / grandTotal) * 1000) / 10 : 0,
      trend: m.trend,
      lastSeen: "",
      trail: m.trail,
    }));

  const sort = params.sort ?? "total";
  const dir = params.dir ?? "desc";
  const factor = dir === "asc" ? 1 : -1;
  const key = (r: MerchantRow): number | string => {
    if (sort === "name") return r.name.toLowerCase();
    if (sort === "visits") return r.visits;
    if (sort === "trend") return r.trend;
    if (sort === "avgTransaction") return Number.parseFloat(r.avgTransaction);
    return Number.parseFloat(r.total);
  };
  all.sort((a, b) => {
    const av = key(a);
    const bv = key(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const total = all.length;
  const rows = all.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  const byTotal = [...all].sort((a, b) => Number.parseFloat(b.total) - Number.parseFloat(a.total));
  const byVisits = [...all].sort((a, b) => b.visits - a.visits);
  const byTrend = [...all].sort((a, b) => b.trend - a.trend);

  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    sort,
    dir,
    appliedFilters: needle ? { q: needle } : {},
    summary: {
      merchantCount: all.length,
      totalSpend: grandTotal.toFixed(2),
      topMerchant: byTotal[0] ? { name: byTotal[0].name, total: byTotal[0].total } : null,
      mostVisited: byVisits[0] ? { name: byVisits[0].name, visits: byVisits[0].visits } : null,
      fastestGrowing: byTrend[0] ? { name: byTrend[0].name, trend: byTrend[0].trend } : null,
    },
    isLive: false,
  };
}

export async function getCalendar(): Promise<CalendarResponse> {
  await delay();
  return calendarData as CalendarResponse;
}

export async function getForecast(): Promise<ForecastResponse> {
  await delay();
  return forecastData as ForecastResponse;
}
