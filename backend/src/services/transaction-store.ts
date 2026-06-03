import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, transactions } from "../db/schema.js";
import { getMemberMapForAccounts } from "./household-store.js";

export async function listAccounts(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
    .orderBy(accounts.name);

  const memberMap = await getMemberMapForAccounts(rows.map((row) => row.id));

  return {
    accounts: rows.map((row) => {
      const member = memberMap.get(row.id);
      return {
        id: row.id,
        plaidItemId: row.plaidItemId,
        name: row.name,
        officialName: row.officialName,
        type: row.type as "depository" | "credit" | "investment",
        subtype: row.subtype,
        mask: row.mask,
        balanceCurrent: row.balanceCurrent ?? "0.00",
        balanceAvailable: row.balanceAvailable ?? null,
        currencyCode: row.currencyCode,
        institutionName: row.institutionName,
        lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
        status: (row.status ?? "active") as "active" | "error" | "reauth_required",
        source: row.source ?? "import",
        memberId: member?.memberId ?? null,
        memberName: member?.memberName ?? null,
        memberColor: member?.memberColor ?? null,
      };
    }),
  };
}

export type TransactionSort =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "name_asc"
  | "name_desc"
  | "category_asc";

function transactionOrderBy(sort: TransactionSort = "date_desc") {
  switch (sort) {
    case "date_asc":
      return [asc(transactions.date), asc(transactions.createdAt)];
    case "amount_desc":
      return [desc(transactions.amount), desc(transactions.date)];
    case "amount_asc":
      return [asc(transactions.amount), desc(transactions.date)];
    case "name_asc":
      return [asc(transactions.name), desc(transactions.date)];
    case "name_desc":
      return [desc(transactions.name), desc(transactions.date)];
    case "category_asc":
      return [asc(transactions.category), desc(transactions.date)];
    default:
      return [desc(transactions.date), desc(transactions.createdAt)];
  }
}

export async function listTransactions(filters: {
  userId: string;
  month?: string;
  category?: string;
  accountId?: string;
  scopedAccountIds?: string[] | null;
  q?: string;
  type?: string;
  sort?: TransactionSort;
  limit?: number;
  cursor?: string;
}) {
  const db = getDb();
  const limit = filters.limit ?? 50;
  const conditions = [eq(transactions.userId, filters.userId)];

  if (filters.scopedAccountIds !== undefined && filters.scopedAccountIds !== null) {
    if (filters.scopedAccountIds.length === 0) {
      return { items: [], nextCursor: null };
    }
    conditions.push(inArray(transactions.accountId, filters.scopedAccountIds));
  }

  if (filters.month) {
    const [year, month] = filters.month.split("-");
    const start = `${year}-${month}-01`;
    const endMonth = Number.parseInt(month!, 10);
    const endYear = Number.parseInt(year!, 10);
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const end = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
    conditions.push(gte(transactions.date, start));
    conditions.push(lte(transactions.date, end));
  }

  if (filters.category) {
    conditions.push(eq(transactions.category, filters.category));
  }
  if (filters.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.type) {
    conditions.push(eq(transactions.transactionType, filters.type));
  }
  if (filters.q) {
    const q = `%${filters.q}%`;
    conditions.push(
      or(ilike(transactions.name, q), ilike(transactions.merchantName, q))!,
    );
  }

  let query = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      accountMask: accounts.mask,
      date: transactions.date,
      name: transactions.name,
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      currencyCode: transactions.currencyCode,
      category: transactions.category,
      transactionType: transactions.transactionType,
      isTransfer: transactions.isTransfer,
      pending: transactions.pending,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .orderBy(...transactionOrderBy(filters.sort))
    .limit(limit + 1);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const rows = await query;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const memberMap = await getMemberMapForAccounts(page.map((row) => row.accountId));

  return {
    items: page.map((row) => {
      const member = memberMap.get(row.accountId);
      return {
        id: row.id,
        accountId: row.accountId,
        accountMask: row.accountMask,
        date: row.date,
        name: row.name,
        merchantName: row.merchantName,
        amount: row.amount,
        currencyCode: row.currencyCode,
        category: row.category,
        transactionType: row.transactionType as "expense" | "income" | "transfer",
        isTransfer: row.isTransfer,
        pending: row.pending,
        memberId: member?.memberId ?? null,
        memberName: member?.memberName ?? null,
        memberColor: member?.memberColor ?? null,
      };
    }),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

export async function getSummary(userId: string, from?: string, to?: string) {
  const db = getDb();
  const dateFilter =
    from && to
      ? sql`date >= ${from} AND date <= ${to}`
      : sql`TRUE`;

  const spendRows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(amount::numeric), 0)::text AS total
    FROM transactions
    WHERE user_id = ${userId}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND ${dateFilter}
  `);

  const incomeRows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions
    WHERE user_id = ${userId}
      AND transaction_type = 'income'
      AND is_transfer = false
      AND ${dateFilter}
  `);

  const transferRows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions
    WHERE user_id = ${userId}
      AND is_transfer = true
      AND ${dateFilter}
  `);

  const topCategoryRows = await db.execute<{
    name: string;
    amount: string;
  }>(sql`
    SELECT category AS name, SUM(amount::numeric)::text AS amount
    FROM transactions
    WHERE user_id = ${userId}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND ${dateFilter}
    GROUP BY category
    ORDER BY SUM(amount::numeric) DESC
    LIMIT 1
  `);

  const totalSpent = spendRows[0]?.total ?? "0.00";
  const income = incomeRows[0]?.total ?? "0.00";
  const ccPaymentsExcluded = transferRows[0]?.total ?? "0.00";
  const incomeNum = Number.parseFloat(income);
  const spentNum = Number.parseFloat(totalSpent);
  const net = incomeNum - spentNum;

  return {
    totalSpent,
    income,
    netSavings: net.toFixed(2),
    avgMonthlySpend: totalSpent,
    topCategory: topCategoryRows[0] ?? { name: "None", amount: "0.00" },
    ccPaymentsExcluded,
    savingsRate: incomeNum > 0 ? net / incomeNum : 0,
  };
}

export async function getCategories(userId: string, from?: string, to?: string) {
  const db = getDb();
  const dateFilter =
    from && to
      ? sql`date >= ${from} AND date <= ${to}`
      : sql`TRUE`;

  const rows = await db.execute<{
    name: string;
    amount: string;
  }>(sql`
    SELECT category AS name, SUM(amount::numeric)::text AS amount
    FROM transactions
    WHERE user_id = ${userId}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND ${dateFilter}
    GROUP BY category
    ORDER BY SUM(amount::numeric) DESC
  `);

  const total = rows.reduce(
    (sum, row) => sum + Number.parseFloat(row.amount),
    0,
  );

  return {
    categories: rows.map((row) => ({
      name: row.name,
      amount: row.amount,
      percentage: total > 0 ? (Number.parseFloat(row.amount) / total) * 100 : 0,
      deltaVsPriorMonth: 0,
    })),
  };
}

export async function getMoneyFlow(userId: string, from?: string, to?: string) {
  void from;
  void to;
  const db = getDb();

  const incomeSources = await db.execute<{ label: string; amount: string }>(sql`
    SELECT name AS label, SUM(ABS(amount::numeric))::text AS amount
    FROM transactions
    WHERE user_id = ${userId}
      AND transaction_type = 'income' AND is_transfer = false
    GROUP BY name
    ORDER BY SUM(ABS(amount::numeric)) DESC
    LIMIT 10
  `);

  const bankAccounts = await db.execute<{ label: string; amount: string }>(sql`
    SELECT a.name AS label, SUM(ABS(t.amount::numeric))::text AS amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.user_id = ${userId}
      AND a.type = 'depository' AND t.transaction_type = 'expense' AND t.is_transfer = false
    GROUP BY a.name
  `);

  const creditCards = await db.execute<{ label: string; amount: string }>(sql`
    SELECT a.name AS label, SUM(t.amount::numeric)::text AS amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.user_id = ${userId}
      AND a.type = 'credit' AND t.transaction_type = 'expense' AND t.is_transfer = false
    GROUP BY a.name
  `);

  const monthlySeries = await db.execute<{
    month: string;
    income: string;
    expenses: string;
    net: string;
  }>(sql`
    SELECT
      to_char(date_trunc('month', date), 'YYYY-MM') AS month,
      COALESCE(SUM(CASE WHEN transaction_type = 'income' AND NOT is_transfer THEN ABS(amount::numeric) ELSE 0 END), 0)::text AS income,
      COALESCE(SUM(CASE WHEN transaction_type = 'expense' AND NOT is_transfer THEN amount::numeric ELSE 0 END), 0)::text AS expenses,
      COALESCE(SUM(CASE WHEN transaction_type = 'income' AND NOT is_transfer THEN ABS(amount::numeric) WHEN transaction_type = 'expense' AND NOT is_transfer THEN -amount::numeric ELSE 0 END), 0)::text AS net
    FROM transactions
    WHERE user_id = ${userId}
    GROUP BY date_trunc('month', date)
    ORDER BY month
  `);

  const incomeTotal = incomeSources.reduce(
    (s, r) => s + Number.parseFloat(r.amount),
    0,
  );
  const transferTotal = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions WHERE user_id = ${userId} AND is_transfer = true
  `);
  const ccTotal = creditCards.reduce(
    (s, r) => s + Number.parseFloat(r.amount),
    0,
  );

  return {
    income: {
      sources: incomeSources,
      total: incomeTotal.toFixed(2),
    },
    bankAccounts: {
      accounts: bankAccounts,
      transfersOut: transferTotal[0]?.total ?? "0.00",
    },
    creditCards: {
      accounts: creditCards,
      totalCharges: ccTotal.toFixed(2),
    },
    monthlySeries,
  };
}

export async function getTrends(userId: string, from?: string, to?: string) {
  void from;
  void to;
  const db = getDb();

  const rows = await db.execute<{
    name: string;
    month: string;
    amount: string;
  }>(sql`
    SELECT
      category AS name,
      to_char(date_trunc('month', date), 'YYYY-MM') AS month,
      SUM(amount::numeric)::text AS amount
    FROM transactions
    WHERE user_id = ${userId}
      AND transaction_type = 'expense' AND NOT is_transfer
    GROUP BY category, date_trunc('month', date)
    ORDER BY category, month
  `);

  const byCategory = new Map<string, { month: string; amount: string }[]>();
  for (const row of rows) {
    const list = byCategory.get(row.name) ?? [];
    list.push({ month: row.month, amount: row.amount });
    byCategory.set(row.name, list);
  }

  return {
    trends: [...byCategory.entries()]
      .slice(0, 8)
      .map(([name, months]) => ({ name, months })),
  };
}

export interface ChartDataParams {
  userId: string;
  from?: string;
  to?: string;
  accountId?: string;
  category?: string;
  scopedAccountIds?: string[] | null;
}

function buildChartFilters(params: ChartDataParams) {
  const parts = [sql`t.user_id = ${params.userId}`];
  if (params.from && params.to) {
    parts.push(sql`t.date >= ${params.from} AND t.date <= ${params.to}`);
  }
  if (params.accountId) {
    parts.push(sql`t.account_id = ${params.accountId}`);
  }
  if (params.category) {
    parts.push(sql`t.category = ${params.category}`);
  }
  if (params.scopedAccountIds !== undefined && params.scopedAccountIds !== null) {
    if (params.scopedAccountIds.length === 0) {
      parts.push(sql`FALSE`);
    } else {
      parts.push(
        sql`t.account_id IN (${sql.join(
          params.scopedAccountIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }
  }
  return sql.join(parts, sql` AND `);
}

export async function getChartData(params: ChartDataParams) {
  const db = getDb();
  const whereClause = buildChartFilters(params);

  const monthly = await db.execute<{
    month: string;
    expenses: string;
    income: string;
    net: string;
  }>(sql`
    SELECT
      to_char(date_trunc('month', t.date), 'YYYY-MM') AS month,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' AND NOT t.is_transfer THEN t.amount::numeric ELSE 0 END), 0)::text AS expenses,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'income' AND NOT t.is_transfer THEN ABS(t.amount::numeric) ELSE 0 END), 0)::text AS income,
      COALESCE(SUM(
        CASE
          WHEN t.transaction_type = 'income' AND NOT t.is_transfer THEN ABS(t.amount::numeric)
          WHEN t.transaction_type = 'expense' AND NOT t.is_transfer THEN -t.amount::numeric
          ELSE 0
        END
      ), 0)::text AS net
    FROM transactions t
    WHERE ${whereClause}
    GROUP BY date_trunc('month', t.date)
    ORDER BY month
  `);

  const categoryRows = await db.execute<{ name: string; amount: string }>(sql`
    SELECT t.category AS name, SUM(t.amount::numeric)::text AS amount
    FROM transactions t
    WHERE ${whereClause}
      AND t.transaction_type = 'expense'
      AND NOT t.is_transfer
    GROUP BY t.category
    ORDER BY SUM(t.amount::numeric) DESC
  `);

  const categoryTotal = categoryRows.reduce(
    (sum, row) => sum + Number.parseFloat(row.amount),
    0,
  );

  const accountRows = await db.execute<{
    id: string;
    name: string;
    amount: string;
  }>(sql`
    SELECT a.id, a.name, SUM(t.amount::numeric)::text AS amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE ${whereClause}
      AND t.transaction_type = 'expense'
      AND NOT t.is_transfer
    GROUP BY a.id, a.name
    ORDER BY SUM(t.amount::numeric) DESC
  `);

  const accountTotal = accountRows.reduce(
    (sum, row) => sum + Number.parseFloat(row.amount),
    0,
  );

  const memberRows = await db.execute<{
    id: string;
    name: string;
    color: string;
    amount: string;
  }>(sql`
    SELECT
      hm.id,
      hm.display_name AS name,
      hm.avatar_color AS color,
      COALESCE(SUM(t.amount::numeric), 0)::text AS amount
    FROM transactions t
    JOIN household_account_assignments haa ON haa.account_id = t.account_id
    JOIN household_members hm ON hm.id = haa.member_id
    WHERE ${whereClause}
      AND t.transaction_type = 'expense'
      AND NOT t.is_transfer
    GROUP BY hm.id, hm.display_name, hm.avatar_color
    ORDER BY SUM(t.amount::numeric) DESC
  `);

  const memberTotal = memberRows.reduce(
    (sum, row) => sum + Number.parseFloat(row.amount),
    0,
  );

  const trendRows = await db.execute<{
    name: string;
    month: string;
    amount: string;
  }>(sql`
    SELECT
      t.category AS name,
      to_char(date_trunc('month', t.date), 'YYYY-MM') AS month,
      SUM(t.amount::numeric)::text AS amount
    FROM transactions t
    WHERE ${whereClause}
      AND t.transaction_type = 'expense'
      AND NOT t.is_transfer
    GROUP BY t.category, date_trunc('month', t.date)
    ORDER BY t.category, month
  `);

  const trendsByCategory = new Map<string, { month: string; amount: string }[]>();
  for (const row of trendRows) {
    const list = trendsByCategory.get(row.name) ?? [];
    list.push({ month: row.month, amount: row.amount });
    trendsByCategory.set(row.name, list);
  }

  const categoryTrends = [...trendsByCategory.entries()]
    .sort((a, b) => {
      const totalA = a[1].reduce(
        (sum, point) => sum + Number.parseFloat(point.amount),
        0,
      );
      const totalB = b[1].reduce(
        (sum, point) => sum + Number.parseFloat(point.amount),
        0,
      );
      return totalB - totalA;
    })
    .slice(0, params.category ? 1 : 5)
    .map(([name, months]) => ({ name, months }));

  const expenseTotal = monthly.reduce(
    (sum, row) => sum + Number.parseFloat(row.expenses),
    0,
  );
  const incomeTotal = monthly.reduce(
    (sum, row) => sum + Number.parseFloat(row.income),
    0,
  );

  return {
    monthly,
    byCategory: categoryRows.map((row) => ({
      name: row.name,
      amount: row.amount,
      percentage:
        categoryTotal > 0
          ? (Number.parseFloat(row.amount) / categoryTotal) * 100
          : 0,
    })),
    byAccount: accountRows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      percentage:
        accountTotal > 0
          ? (Number.parseFloat(row.amount) / accountTotal) * 100
          : 0,
    })),
    byMember: memberRows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      amount: row.amount,
      percentage:
        memberTotal > 0
          ? (Number.parseFloat(row.amount) / memberTotal) * 100
          : 0,
    })),
    categoryTrends,
    totals: {
      expenses: expenseTotal.toFixed(2),
      income: incomeTotal.toFixed(2),
      net: (incomeTotal - expenseTotal).toFixed(2),
    },
  };
}

export async function getAlerts() {
  return {
    alerts: [],
  };
}

export async function transactionCount(userId?: string): Promise<number> {
  const db = getDb();
  if (userId) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.userId, userId));
    return row?.count ?? 0;
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions);
  return row?.count ?? 0;
}
