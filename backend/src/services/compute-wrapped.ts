import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { savingsGoals, transactions } from "../db/schema.js";
import { formatMoneyAmount, roundDecimal, roundPercent } from "../lib/money.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";
import type { WrappedResponse } from "./coach-store.js";

const ARCHETYPE_BY_CATEGORY: Record<string, string> = {
  "Dining & Restaurants": "The Experience Seeker",
  "Food & Groceries": "The Home Chef",
  Travel: "The Explorer",
  "Shopping & Retail": "The Curator",
  Entertainment: "The Fun Seeker",
  Transportation: "The Road Warrior",
  "Subscriptions & Software": "The Optimizer",
};

const DINING_KEYWORDS = /restaurant|dining|grubhub|doordash|uber eats|postmates|seamless/i;
const DELIVERY_KEYWORDS = /doordash|grubhub|uber eats|postmates|seamless|delivery/i;
const COFFEE_KEYWORDS = /starbucks|dunkin|coffee|peet/i;

function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function monthName(monthKey: string): string {
  const month = Number.parseInt(monthKey.slice(5, 7), 10);
  return new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
}

export async function computeWrappedFromTransactions(
  userIds: string[],
): Promise<WrappedResponse | null> {
  const db = getDb();

  const [yearRow] = await db
    .select({
      year: sql<number>`max(extract(year from ${transactions.date})::int)`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, userIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
      ),
    );

  const year = yearRow?.year;
  if (!year) {
    return null;
  }

  const { start, end } = yearBounds(year);
  const rows = await db
    .select({
      date: transactions.date,
      name: transactions.name,
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      category: transactions.category,
      subCategory: transactions.subCategory,
      transactionType: transactions.transactionType,
      isTransfer: transactions.isTransfer,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, userIds),
        eq(transactions.pending, false),
        sql`${transactions.date} >= ${start} and ${transactions.date} <= ${end}`,
      ),
    );

  const expenses = rows.filter(
    (r) =>
      r.transactionType === "expense" &&
      !r.isTransfer &&
      r.category !== INTERNAL_TRANSFER_CATEGORY,
  );
  const incomeRows = rows.filter(
    (r) => r.transactionType === "income" && !r.isTransfer,
  );

  if (expenses.length === 0) {
    return null;
  }

  let totalSpent = 0;
  let totalIncome = 0;
  const categoryTotals = new Map<string, number>();
  const spendByDate = new Map<string, number>();
  const spendByMonth = new Map<string, { income: number; spending: number }>();

  for (const r of incomeRows) {
    const amt = Math.abs(Number.parseFloat(r.amount));
    totalIncome += amt;
    const monthKey = r.date.slice(0, 7);
    const bucket = spendByMonth.get(monthKey) ?? { income: 0, spending: 0 };
    bucket.income += amt;
    spendByMonth.set(monthKey, bucket);
  }

  let biggestPurchase = { amount: 0, label: "" };
  let restaurantVisits = 0;
  let deliveryOrders = 0;
  let coffeeRuns = 0;
  let travelTrips = 0;

  for (const r of expenses) {
    const amt = Number.parseFloat(r.amount);
    totalSpent += amt;

    const monthKey = r.date.slice(0, 7);
    const bucket = spendByMonth.get(monthKey) ?? { income: 0, spending: 0 };
    bucket.spending += amt;
    spendByMonth.set(monthKey, bucket);

    spendByDate.set(r.date, (spendByDate.get(r.date) ?? 0) + amt);
    categoryTotals.set(r.category, (categoryTotals.get(r.category) ?? 0) + amt);

    const label = r.merchantName ?? r.name;
    if (amt > biggestPurchase.amount) {
      biggestPurchase = { amount: amt, label };
    }

    const haystack = `${label} ${r.category} ${r.subCategory ?? ""}`;
    if (DINING_KEYWORDS.test(haystack) || r.category === "Dining & Restaurants") {
      restaurantVisits += 1;
    }
    if (DELIVERY_KEYWORDS.test(haystack)) {
      deliveryOrders += 1;
    }
    if (COFFEE_KEYWORDS.test(haystack)) {
      coffeeRuns += 1;
    }
    if (r.category === "Travel") {
      travelTrips += 1;
    }
  }

  const totalSaved = Math.max(totalIncome - totalSpent, 0);
  const savingsRate =
    totalIncome > 0 ? roundPercent((totalSaved / totalIncome) * 100) : 0;

  const topCategoryEntry = [...categoryTotals.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const topCategoryName = topCategoryEntry?.[0] ?? "Uncategorized";
  const topCategoryAmount = topCategoryEntry?.[1] ?? 0;

  let bestSavingsMonth = { month: "", saved: -Infinity };
  for (const [monthKey, totals] of spendByMonth) {
    const saved = totals.income - totals.spending;
    if (saved > bestSavingsMonth.saved) {
      bestSavingsMonth = { month: monthKey, saved };
    }
  }

  const noSpendDays = (() => {
    const startDate = new Date(`${year}-01-01T12:00:00Z`);
    const endDate = new Date(`${year}-12-31T12:00:00Z`);
    let count = 0;
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const key = d.toISOString().slice(0, 10);
      if (!spendByDate.has(key)) {
        count += 1;
      }
    }
    return count;
  })();

  const goalRows = await db
    .select()
    .from(savingsGoals)
    .where(inArray(savingsGoals.userId, userIds));

  const personality: Record<string, number> = {
    restaurantVisits,
    deliveryOrders,
    coffeeRuns,
    travelTrips,
  };

  return {
    year,
    totalSpent: formatMoneyAmount(totalSpent),
    transactionCount: expenses.length,
    totalSaved: formatMoneyAmount(totalSaved),
    savingsRate: roundDecimal(savingsRate),
    peerPercentile: null,
    archetype: ARCHETYPE_BY_CATEGORY[topCategoryName] ?? "The Spender",
    topCategory: {
      name: topCategoryName,
      amount: formatMoneyAmount(topCategoryAmount),
    },
    personality,
    moments: [
      {
        label: "Biggest purchase",
        value:
          biggestPurchase.amount > 0
            ? `${formatUsd(biggestPurchase.amount)} at ${biggestPurchase.label}`
            : "—",
      },
      {
        label: "Best savings month",
        value:
          bestSavingsMonth.month !== ""
            ? `${monthName(bestSavingsMonth.month)} — saved ${formatUsd(Math.max(bestSavingsMonth.saved, 0))}`
            : "—",
      },
      {
        label: "Most frugal days",
        value: `${noSpendDays} no-spend days`,
      },
      {
        label: "Top category",
        value: `${topCategoryName} — ${formatUsd(topCategoryAmount)}`,
      },
    ],
    goals: goalRows.map((g) => {
      const target = Number.parseFloat(g.targetAmount);
      const current = Number.parseFloat(g.currentAmount);
      return {
        label: g.name,
        target: formatMoneyAmount(target),
        pct: target > 0 ? roundPercent((current / target) * 100) : 0,
      };
    }),
  };
}
