import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  budgets,
  fireProfiles,
  lifestyleHabits,
  recurringSeries,
  savingsGoals,
  transactions,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import { resolveHouseholdContext } from "./household-access.js";

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
  const db = getDb();
  const [row] = await db
    .select({ maxDate: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
    .where(inArray(transactions.userId, userIds));
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

export interface BudgetsResponse {
  periodMonth: string;
  safeToSpend: string;
  daysRemaining: number;
  budgets: Array<{
    category: string;
    emoji: string | null;
    color: string | null;
    spent: string;
    limit: string;
  }>;
  goals: Array<{
    name: string;
    emoji: string | null;
    color: string | null;
    target: string;
    current: string;
    deadline: string | null;
  }>;
}

export async function getBudgets(userId: string): Promise<BudgetsResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const budgetRows = await db
    .select()
    .from(budgets)
    .where(inArray(budgets.userId, ctx.userIds));

  const period =
    budgetRows.reduce<string>(
      (latest, b) => (b.periodMonth > latest ? b.periodMonth : latest),
      "0000-00",
    ) || "2026-05";
  const current = budgetRows.filter((b) => b.periodMonth === period);
  const { start, end } = monthBounds(period);

  const spentRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, ctx.userIds),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.pending, false),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    )
    .groupBy(transactions.category);
  const spentByCategory = new Map(
    spentRows.map((r) => [r.category, Number.parseFloat(r.total ?? "0")]),
  );

  let totalLimit = 0;
  let totalSpent = 0;
  const budgetItems = current.map((b) => {
    const limit = Number.parseFloat(b.limitAmount);
    const spent = spentByCategory.get(b.category) ?? 0;
    totalLimit += limit;
    totalSpent += spent;
    return {
      category: b.category,
      emoji: b.emoji,
      color: b.color,
      spent: formatMoneyAmount(spent),
      limit: formatMoneyAmount(limit),
    };
  });

  const goalRows = await db
    .select()
    .from(savingsGoals)
    .where(inArray(savingsGoals.userId, ctx.userIds));

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
    budgets: budgetItems,
    goals: goalRows.map((g) => ({
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      target: formatMoneyAmount(g.targetAmount),
      current: formatMoneyAmount(g.currentAmount),
      deadline: g.deadline,
    })),
  };
}

export interface RecurringResponse {
  monthlyTotal: string;
  annualTotal: string;
  activeCount: number;
  priceChanges: number;
  subscriptions: RecurringItem[];
  bills: RecurringItem[];
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
  };
}

interface RecurringItem {
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

export async function getRecurring(userId: string): Promise<RecurringResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const rows = await db
    .select()
    .from(recurringSeries)
    .where(inArray(recurringSeries.userId, ctx.userIds));

  const toItem = (r: typeof rows[number]): RecurringItem => ({
    merchantName: r.merchantName,
    category: r.category,
    kind: r.kind,
    amount: formatMoneyAmount(r.amount),
    cadence: r.cadence,
    nextChargeDate: r.nextChargeDate,
    lastChargeDate: r.lastChargeDate,
    previousAmount: r.previousAmount ? formatMoneyAmount(r.previousAmount) : null,
    priceChanged: r.priceChanged,
    status: r.status,
    brandColor: r.brandColor,
  });

  const subscriptions = rows.filter((r) => r.kind === "subscription").map(toItem);
  const bills = rows.filter((r) => r.kind === "bill").map(toItem);

  const monthlyTotal = subscriptions.reduce(
    (s, r) => s + Number.parseFloat(r.amount),
    0,
  );

  const feeRows = await db
    .select({
      subCategory: transactions.subCategory,
      total: sql<string>`sum(${transactions.amount})`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, ctx.userIds),
        eq(transactions.subCategory, "Bank Fees"),
      ),
    )
    .groupBy(transactions.subCategory);
  const bankFees = feeRows[0];

  const habitRows = await db
    .select()
    .from(lifestyleHabits)
    .where(inArray(lifestyleHabits.userId, ctx.userIds));

  return {
    monthlyTotal: formatMoneyAmount(monthlyTotal),
    annualTotal: formatMoneyAmount(monthlyTotal * 12),
    activeCount: subscriptions.filter((s) => s.status === "active").length,
    priceChanges: subscriptions.filter((s) => s.priceChanged).length,
    subscriptions,
    bills,
    leaks: {
      fees: [
        {
          id: "atm",
          label: "ATM & overdraft fees",
          source: "Checking",
          count: bankFees?.count ?? 0,
          total: formatMoneyAmount(bankFees?.total ?? "0"),
          fixable: true,
        },
      ],
      habits: habitRows.map((h) => ({
        id: h.label.toLowerCase().replace(/\s+/g, "-"),
        emoji: h.emoji,
        label: h.label,
        monthly: formatMoneyAmount(h.monthlyAmount),
      })),
    },
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

export async function getFire(userId: string): Promise<FireResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const [row] = await db
    .select()
    .from(fireProfiles)
    .where(inArray(fireProfiles.userId, ctx.userIds))
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    currentAge: row.currentAge,
    currentNetWorth: formatMoneyAmount(row.currentNetWorth),
    monthlySpend: formatMoneyAmount(row.monthlySpend),
    monthlyInvest: formatMoneyAmount(row.monthlyInvest),
    withdrawalRate: roundDecimal(Number.parseFloat(row.withdrawalRate)),
    realReturn: roundDecimal(Number.parseFloat(row.realReturn)),
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

  const incomeRows = await db
    .select({
      date: transactions.date,
      name: transactions.name,
      amount: sql<string>`sum(abs(${transactions.amount}))`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, ctx.userIds),
        eq(transactions.transactionType, "income"),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    )
    .groupBy(transactions.date, transactions.name);
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

  const dailyRows = await db
    .select({
      date: transactions.date,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, ctx.userIds),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.pending, false),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    )
    .groupBy(transactions.date);
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
