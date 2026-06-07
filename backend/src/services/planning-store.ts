import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  budgets,
  lifestyleHabits,
  recurringSeries,
  savingsGoals,
  transactions,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  paginateInMemory,
  type Page,
  type ParsedListQuery,
} from "../lib/list-query.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { detectRecurringFromTransactions } from "./detect-recurring.js";
import {
  auditsToLegacyHabits,
  generateCostAudits,
  type CostAudit,
} from "./cost-audit-engine.js";
import { detectHiddenFees } from "./fee-detection.js";
import {
  applyRecurringLifecycleFields,
  type RecurringLifecycleStatus,
} from "./recurring-lifecycle.js";
import { buildSuggestedBudgets } from "./planning/budget-suggestions.js";
import { buildSuggestedGoals } from "./planning/goal-suggestions.js";
import type { BudgetClass, BudgetSource, GoalKind, GoalSource, GoalStatus } from "./planning/planning-crud.js";
import {
  computeFireProfileInputs,
  refreshFireProfile,
} from "./investment-analytics.js";
import {
  buildTimeMachineSummary,
  computeFireProjection,
  type FireProjection,
  type TimeMachineSummary,
} from "./computed-fields.js";
import { resolveHouseholdContext } from "./household-access.js";
import {
  getAnalyticsProfile,
  updateAnalyticsProfile,
  type AnalyticsProfileResponse,
  type FireProfilePatch,
} from "./user-profile-store.js";

export type { AnalyticsProfileResponse, FireProfilePatch };
export { getAnalyticsProfile, updateAnalyticsProfile };

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Latest transaction month (YYYY-MM) for the household, or current month. */
async function latestMonth(userIds: string[]): Promise<string> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) {
    return new Date().toISOString().slice(0, 7);
  }
  const db = getDb();
  const [row] = await db
    .select({ maxDate: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
    .where(drizzleActiveTransactionWhere(userIds, accountIds));
  const maxDate = row?.maxDate;
  if (maxDate) {
    return maxDate.slice(0, 7);
  }
  return new Date().toISOString().slice(0, 7);
}

function monthBounds(period: string): { start: string; end: string } {
  const [y, mo] = period.split("-").map(Number);
  const lastDay = new Date(y!, mo!, 0).getDate();
  return { start: `${period}-01`, end: `${period}-${String(lastDay).padStart(2, "0")}` };
}

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
  confidence?: "low" | "medium" | "high";
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
  confidence?: "low" | "medium" | "high";
  monthlySetAside?: string;
  accountId?: string | null;
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

export async function getBudgets(userId: string): Promise<BudgetsResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(ctx.userIds);
  const db = getDb();

  const budgetRows = await db
    .select()
    .from(budgets)
    .where(inArray(budgets.userId, ctx.userIds));

  const period = await latestMonth(ctx.userIds);
  const configured = budgetRows.filter((b) => b.periodMonth === period);
  const { start, end } = monthBounds(period);

  const spentRows = hasActiveAccounts
    ? await db
        .select({
          category: transactions.category,
          total: sql<string>`sum(${transactions.amount})`,
        })
        .from(transactions)
        .where(
          and(
            drizzleActiveTransactionWhere(ctx.userIds, accountIds),
            eq(transactions.transactionType, "expense"),
            eq(transactions.isTransfer, false),
            eq(transactions.pending, false),
            gte(transactions.date, start),
            lte(transactions.date, end),
          ),
        )
        .groupBy(transactions.category)
    : [];
  const spentByCategory = new Map(
    spentRows.map((r) => [r.category, Number.parseFloat(r.total ?? "0")]),
  );

  const hasTransactionData = spentRows.length > 0;
  let budgetItems: BudgetItem[];
  let isLive = false;

  if (configured.length > 0) {
    isLive = true;
    budgetItems = configured.map((b) => {
      const limit = Number.parseFloat(b.limitAmount);
      const spent = spentByCategory.get(b.category) ?? 0;
      return {
        id: b.id,
        category: b.category,
        emoji: b.emoji,
        color: b.color,
        spent: formatMoneyAmount(spent),
        limit: formatMoneyAmount(limit),
        source: b.source as BudgetSource,
        class: (b.class as BudgetClass | null) ?? null,
      };
    });
  } else {
    budgetItems = [];
  }

  const budgetedCategories = new Set(configured.map((b) => b.category));
  const suggestedBudgets = hasTransactionData
    ? await buildSuggestedBudgets(
        ctx.userIds,
        period,
        budgetedCategories,
        spentByCategory,
      )
    : [];

  if (!isLive && suggestedBudgets.length > 0) {
    isLive = true;
  }

  let totalLimit = 0;
  let totalSpent = 0;
  for (const b of budgetItems) {
    totalLimit += Number.parseFloat(b.limit);
    totalSpent += Number.parseFloat(b.spent);
  }
  if (totalLimit === 0 && suggestedBudgets.length > 0) {
    for (const b of suggestedBudgets) {
      totalLimit += Number.parseFloat(b.limit);
      totalSpent += Number.parseFloat(b.spent);
    }
  }

  const goalRows = await db
    .select()
    .from(savingsGoals)
    .where(
      and(
        inArray(savingsGoals.userId, ctx.userIds),
        eq(savingsGoals.status, "active"),
      ),
    );

  const suggestedGoals = await buildSuggestedGoals(userId);

  const [y, mo] = period.split("-").map(Number);
  const lastDay = new Date(y!, mo!, 0).getDate();
  const now = new Date();
  const isCurrentPeriod =
    now.getFullYear() === y && now.getMonth() + 1 === mo;
  const daysRemaining = isCurrentPeriod
    ? Math.max(lastDay - now.getDate(), 0)
    : 0;
  const remaining = Math.max(totalLimit - totalSpent, 0);
  const safeToSpend = daysRemaining > 0 ? remaining / daysRemaining : remaining;

  return {
    periodMonth: period,
    safeToSpend: formatMoneyAmount(safeToSpend),
    daysRemaining,
    isLive,
    budgets: budgetItems,
    suggestedBudgets,
    goals: goalRows.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      target: formatMoneyAmount(g.targetAmount),
      current: formatMoneyAmount(g.currentAmount),
      deadline: g.deadline,
      kind: g.kind as GoalKind,
      status: g.status as GoalStatus,
      source: g.source as GoalSource,
      accountId: g.accountId,
    })),
    suggestedGoals,
  };
}

export const RECURRING_SORTABLE = [
  "merchantName",
  "amount",
  "category",
  "nextChargeDate",
  "status",
] as const;

export interface RecurringResponse {
  monthlyTotal: string;
  annualTotal: string;
  activeCount: number;
  priceChanges: number;
  isLive: boolean;
  subscriptions: Page<RecurringItem>;
  bills: Page<RecurringItem>;
  leaks: {
    fees: Array<{
      id: string;
      label: string;
      source: string;
      count: number;
      total: string;
      fixable: boolean;
    }>;
    habits: Array<{ id: string; emoji: string | null; label: string; monthly: string }>;
    audits: CostAudit[];
  };
  timeMachine: TimeMachineSummary;
}

interface RecurringItem {
  merchantName: string;
  category: string;
  kind: "subscription" | "bill" | string;
  amount: string;
  cadence: string;
  nextChargeDate: string | null;
  lastChargeDate: string | null;
  previousAmount: string | null;
  priceChanged: boolean;
  status: RecurringLifecycleStatus;
  brandColor: string | null;
}

function recurringSortKey(column: string): (row: RecurringItem) => number | string {
  switch (column) {
    case "merchantName":
      return (r) => r.merchantName.toLowerCase();
    case "category":
      return (r) => r.category.toLowerCase();
    case "nextChargeDate":
      return (r) => r.nextChargeDate ?? "";
    case "status":
      return (r) => r.status;
    default:
      return (r) => Number.parseFloat(r.amount);
  }
}

function paginateRecurring(
  rows: RecurringItem[],
  q: ParsedListQuery,
): Page<RecurringItem> {
  return paginateInMemory(rows, q, {
    sortKey: recurringSortKey,
    textFilter: (row, needle) =>
      row.merchantName.toLowerCase().includes(needle) ||
      row.category.toLowerCase().includes(needle),
  });
}

function withLifecycle(r: {
  merchantName: string;
  category: string;
  kind: string;
  amount: string | number;
  cadence: string;
  nextChargeDate: string | null;
  lastChargeDate: string | null;
  previousAmount: string | number | null;
  priceChanged: boolean;
  status: string;
  brandColor: string | null;
}): RecurringItem {
  const lifecycle = applyRecurringLifecycleFields({
    lastChargeDate: r.lastChargeDate,
    cadence: r.cadence,
    priceChanged: r.priceChanged,
    nextChargeDate: r.nextChargeDate,
  });
  return {
    merchantName: r.merchantName,
    category: r.category,
    kind: r.kind,
    amount: formatMoneyAmount(r.amount),
    cadence: r.cadence,
    nextChargeDate: lifecycle.nextChargeDate,
    lastChargeDate: r.lastChargeDate,
    previousAmount: r.previousAmount
      ? formatMoneyAmount(r.previousAmount)
      : null,
    priceChanged: r.priceChanged,
    status: lifecycle.status,
    brandColor: r.brandColor,
  };
}

function isActiveSubscription(status: RecurringLifecycleStatus): boolean {
  return status === "active" || status === "price-changed";
}

export async function getRecurring(
  userId: string,
  q: ParsedListQuery,
): Promise<RecurringResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(ctx.userIds);
  const db = getDb();

  const rows = hasActiveAccounts
    ? await db
        .select()
        .from(recurringSeries)
        .where(inArray(recurringSeries.userId, ctx.userIds))
    : [];

  const toItem = (r: (typeof rows)[number]): RecurringItem =>
    withLifecycle({
      merchantName: r.merchantName,
      category: r.category,
      kind: r.kind,
      amount: r.amount,
      cadence: r.cadence,
      nextChargeDate: r.nextChargeDate,
      lastChargeDate: r.lastChargeDate,
      previousAmount: r.previousAmount,
      priceChanged: r.priceChanged,
      status: r.status,
      brandColor: r.brandColor,
    });

  let subscriptions: RecurringItem[];
  let bills: RecurringItem[];
  let isLive = false;

  if (rows.length > 0) {
    subscriptions = rows.filter((r) => r.kind === "subscription").map(toItem);
    bills = rows.filter((r) => r.kind === "bill").map(toItem);
    isLive = true;
  } else {
    const detected = await detectRecurringFromTransactions(ctx.userIds);
    subscriptions = detected
      .filter((d) => d.kind === "subscription")
      .map((d) => withLifecycle(d));
    bills = detected.filter((d) => d.kind === "bill").map((d) => withLifecycle(d));
    isLive = detected.length > 0;
  }

  const activeSubscriptions = subscriptions.filter((s) =>
    isActiveSubscription(s.status),
  );
  const monthlyTotal = activeSubscriptions.reduce(
    (s, r) => s + Number.parseFloat(r.amount),
    0,
  );

  const fees = hasActiveAccounts
    ? await detectHiddenFees(ctx.userIds)
    : [];

  const habitRows = hasActiveAccounts
    ? await db
        .select()
        .from(lifestyleHabits)
        .where(inArray(lifestyleHabits.userId, ctx.userIds))
    : [];

  let habits: RecurringResponse["leaks"]["habits"];
  let audits: CostAudit[];

  if (habitRows.length > 0) {
    habits = habitRows.map((h) => ({
      id: h.label.toLowerCase().replace(/\s+/g, "-"),
      emoji: h.emoji,
      label: h.label,
      monthly: formatMoneyAmount(h.monthlyAmount),
    }));
    audits = habits.map((h) => ({
      id: h.id,
      type: "habit" as const,
      emoji: h.emoji ?? "💸",
      title: h.label,
      monthly: h.monthly,
      annual: formatMoneyAmount(Number.parseFloat(h.monthly) * 12),
      opportunityCost10y: formatMoneyAmount(
        Number.parseFloat(h.monthly) * 12 * 10 * 0.07,
      ),
      rationale: "Seeded lifestyle habit from your profile.",
      action: "Review whether this spend still fits your goals.",
      savingsEstimate: formatMoneyAmount(Number.parseFloat(h.monthly) * 0.3),
      confidence: 0.5,
    }));
  } else {
    const recurringForAudits = [...subscriptions, ...bills];
    audits = await generateCostAudits(ctx.userIds, recurringForAudits);
    habits = auditsToLegacyHabits(audits);
  }

  return {
    monthlyTotal: formatMoneyAmount(monthlyTotal),
    annualTotal: formatMoneyAmount(monthlyTotal * 12),
    activeCount: activeSubscriptions.length,
    priceChanges: activeSubscriptions.filter((s) => s.priceChanged).length,
    isLive,
    subscriptions: paginateRecurring(subscriptions, q),
    bills: paginateRecurring(bills, q),
    leaks: {
      fees,
      habits,
      audits,
    },
    timeMachine: buildTimeMachineSummary(habits),
  };
}

export interface FireResponse {
  currentAge: number;
  /** True when age is still the system default (35) — user should set their real age. */
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

export async function updateFireProfile(
  userId: string,
  patch: FireProfilePatch,
): Promise<FireResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) {
    return null;
  }

  await updateAnalyticsProfile(userId, patch);
  return getFire(userId);
}

export async function getFire(
  userId: string,
  overrides?: FireQueryOverrides,
): Promise<FireResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) {
    return null;
  }

  await refreshFireProfile(userId);

  const live = await computeFireProfileInputs(userId, ctx.userIds);
  if (!live) {
    return null;
  }

  const monthlySpend =
    overrides?.monthlySpend ??
    Number.parseFloat(live.monthlySpend);
  const monthlyInvest =
    overrides?.monthlyInvest ??
    Number.parseFloat(live.monthlyInvest);
  const withdrawalRate = overrides?.withdrawalRate ?? live.withdrawalRate;
  const realReturn = overrides?.realReturn ?? live.realReturn;

  const projection = computeFireProjection({
    currentAge: live.currentAge,
    currentNetWorth: Number.parseFloat(live.currentNetWorth),
    monthlySpend,
    monthlyInvest,
    withdrawalRate,
    realReturn,
  });

  return {
    currentAge: live.currentAge,
    isDefaultAge: live.isDefaultAge,
    currentNetWorth: live.currentNetWorth,
    monthlySpend: formatMoneyAmount(monthlySpend),
    monthlyInvest: formatMoneyAmount(monthlyInvest),
    withdrawalRate,
    realReturn,
    projection,
  };
}

export interface CalendarResponse {
  month: string;
  events: Array<{ day: number; type: string; label: string; amount: string }>;
  heat: Array<{ day: number; level: number }>;
  totals: { income: string; bills: string };
  safeToSpendToday: string;
}

/** Money calendar for the latest month — derived from recurring series + transactions. */
export async function getCalendar(userId: string): Promise<CalendarResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(ctx.userIds);
  const db = getDb();

  const month = await latestMonth(ctx.userIds);
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const { start, end } = monthBounds(month);

  const recurringRows = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        inArray(recurringSeries.userId, ctx.userIds),
        inArray(recurringSeries.kind, ["bill", "subscription"]),
      ),
    );

  const events: CalendarResponse["events"] = [];
  let billsTotal = 0;
  for (const r of recurringRows) {
    const amount = Number.parseFloat(r.amount);
    billsTotal += amount;
    const day = r.nextChargeDate
      ? Math.min(Number(r.nextChargeDate.slice(8, 10)) || 1, daysInMonth)
      : 1;
    events.push({
      day,
      type: r.kind,
      label: r.merchantName,
      amount: formatMoneyAmount(amount),
    });
  }

  const incomeRows = hasActiveAccounts
    ? await db
        .select({
          date: transactions.date,
          name: transactions.name,
          amount: sql<string>`sum(abs(${transactions.amount}))`,
        })
        .from(transactions)
        .where(
          and(
            drizzleActiveTransactionWhere(ctx.userIds, accountIds),
            eq(transactions.transactionType, "income"),
            gte(transactions.date, start),
            lte(transactions.date, end),
          ),
        )
        .groupBy(transactions.date, transactions.name)
    : [];
  let incomeTotal = 0;
  for (const r of incomeRows) {
    const amount = Number.parseFloat(r.amount ?? "0");
    incomeTotal += amount;
    events.push({
      day: Math.min(Number(r.date.slice(8, 10)) || 1, daysInMonth),
      type: "income",
      label: r.name,
      amount: formatMoneyAmount(amount),
    });
  }

  const dailyRows = hasActiveAccounts
    ? await db
        .select({
          date: transactions.date,
          total: sql<string>`sum(${transactions.amount})`,
        })
        .from(transactions)
        .where(
          and(
            drizzleActiveTransactionWhere(ctx.userIds, accountIds),
            eq(transactions.transactionType, "expense"),
            eq(transactions.isTransfer, false),
            eq(transactions.pending, false),
            gte(transactions.date, start),
            lte(transactions.date, end),
          ),
        )
        .groupBy(transactions.date)
    : [];
  const spendByDay = new Map<number, number>();
  for (const r of dailyRows) {
    const day = Number(r.date.slice(8, 10));
    spendByDay.set(day, Number.parseFloat(r.total ?? "0"));
  }
  const maxSpend = Math.max(1, ...spendByDay.values());
  const heat = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const spend = spendByDay.get(day) ?? 0;
    return { day, level: Math.min(3, Math.round((spend / maxSpend) * 3)) };
  });

  const now = new Date();
  const isCurrentPeriod =
    now.getFullYear() === year && now.getMonth() + 1 === monthNum;
  const daysRemaining = isCurrentPeriod
    ? Math.max(daysInMonth - now.getDate(), 1)
    : 1;
  const spentSoFar = Array.from(spendByDay.values()).reduce((s, v) => s + v, 0);
  const discretionary = Math.max(incomeTotal - billsTotal - spentSoFar, 0);
  const safeToSpendToday = discretionary / daysRemaining;

  return {
    month,
    events,
    heat,
    totals: {
      income: formatMoneyAmount(incomeTotal),
      bills: formatMoneyAmount(billsTotal),
    },
    safeToSpendToday: formatMoneyAmount(safeToSpendToday),
  };
}

export interface ForecastResponse {
  days: Array<{
    date: string;
    weekday: string;
    weather: string;
    projectedBalance: string;
    note: string;
  }>;
  comfortFloor: string;
  minBalance: string;
  lowestDay: string;
  nextClearDate: string;
  recommendation: string;
}

function weatherFor(balance: number, floor: number): string {
  if (balance < floor) return "stormy";
  if (balance < floor * 1.3) return "cloudy";
  if (balance < floor * 1.6) return "partly";
  return "sunny";
}

/** 14-day cash-flow forecast derived from liquid balances + upcoming recurring charges. */
export async function getForecast(userId: string): Promise<ForecastResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const depository = await db
    .select({ balance: accounts.balanceAvailable, current: accounts.balanceCurrent })
    .from(accounts)
    .where(
      and(inArray(accounts.userId, ctx.userIds), eq(accounts.type, "depository")),
    );
  let liquidCash = 0;
  for (const a of depository) {
    liquidCash += Number.parseFloat(a.balance ?? a.current ?? "0");
  }

  const recurringRows = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        inArray(recurringSeries.userId, ctx.userIds),
        inArray(recurringSeries.kind, ["bill", "subscription"]),
      ),
    );
  const chargeByDom = new Map<number, number>();
  let monthlyBills = 0;
  for (const r of recurringRows) {
    const amount = Number.parseFloat(r.amount);
    monthlyBills += amount;
    const dom = r.nextChargeDate ? Number(r.nextChargeDate.slice(8, 10)) || 1 : 1;
    chargeByDom.set(dom, (chargeByDom.get(dom) ?? 0) + amount);
  }
  const comfortFloor = roundDecimal(Math.max(monthlyBills * 0.75, 1000));

  const month = await latestMonth(ctx.userIds);
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const startDom = Math.min(daysInMonth - 1, 8);

  let balance = liquidCash;
  let minBalance = balance;
  let lowestDay = "";
  let nextClearDate = "";
  const days = Array.from({ length: 14 }, (_, i) => {
    const dom = startDom + i;
    const d = new Date(year, monthNum - 1, dom);
    balance -= chargeByDom.get(dom) ?? 0;
    balance = roundDecimal(balance);
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
    if (balance < minBalance) {
      minBalance = balance;
      lowestDay = label;
    }
    if (!nextClearDate && balance >= comfortFloor) {
      nextClearDate = label;
    }
    return {
      date: label,
      weekday: DOW_LABELS[d.getDay()]!,
      weather: weatherFor(balance, comfortFloor),
      projectedBalance: formatMoneyAmount(balance),
      note: (chargeByDom.get(dom) ?? 0) > 200 ? "Bills cluster" : "",
    };
  });

  const recommendation =
    minBalance < comfortFloor
      ? `Move ~$150 of discretionary spending later to stay above your ${formatMoneyAmount(comfortFloor)} comfort floor.`
      : `You stay above your ${formatMoneyAmount(comfortFloor)} comfort floor all period — on track.`;

  return {
    days,
    comfortFloor: formatMoneyAmount(comfortFloor),
    minBalance: formatMoneyAmount(minBalance),
    lowestDay: lowestDay || days[0]!.date,
    nextClearDate: nextClearDate || days[days.length - 1]!.date,
    recommendation,
  };
}
