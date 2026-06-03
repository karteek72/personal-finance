import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { countMonthsInclusive } from "../lib/date-range.js";
import { formatMoneyAmount, roundDecimal, roundPercent } from "../lib/money.js";
import { accounts, transactions } from "../db/schema.js";
import { getMemberMapForAccounts } from "./household-store.js";
import {
  GENERAL_SUBCATEGORY,
} from "./infer-subcategory.js";
import { INTERNAL_TRANSFER_CATEGORY, CREDIT_CARD_PAYMENT_SUBCATEGORY } from "./transfer-classification.js";

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

// ── Cursor helpers ────────────────────────────────────────────────────────────

interface CursorPayload {
  id: string;
  date: string;
  createdAt: string;
  amount: string;
  name: string;
  category: string;
}

function encodeCursor(row: CursorPayload): string {
  return Buffer.from(JSON.stringify(row)).toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf-8"),
    ) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "date" in parsed &&
      "createdAt" in parsed
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns a SQL condition that selects only rows that come AFTER the cursor
 * position for the given sort order (keyset pagination).
 */
function buildCursorCondition(
  c: CursorPayload,
  sort: TransactionSort = "date_desc",
) {
  switch (sort) {
    case "date_asc":
      return sql`(
        ${transactions.date} > ${c.date}
        OR (${transactions.date} = ${c.date} AND ${transactions.createdAt} > ${c.createdAt}::timestamptz)
      )`;
    case "amount_desc":
      return sql`(
        ${transactions.amount}::numeric < ${c.amount}::numeric
        OR (${transactions.amount}::numeric = ${c.amount}::numeric AND ${transactions.date} < ${c.date})
        OR (${transactions.amount}::numeric = ${c.amount}::numeric AND ${transactions.date} = ${c.date} AND ${transactions.id} < ${c.id})
      )`;
    case "amount_asc":
      return sql`(
        ${transactions.amount}::numeric > ${c.amount}::numeric
        OR (${transactions.amount}::numeric = ${c.amount}::numeric AND ${transactions.date} < ${c.date})
        OR (${transactions.amount}::numeric = ${c.amount}::numeric AND ${transactions.date} = ${c.date} AND ${transactions.id} < ${c.id})
      )`;
    case "name_asc":
      return sql`(
        ${transactions.name} > ${c.name}
        OR (${transactions.name} = ${c.name} AND ${transactions.date} < ${c.date})
        OR (${transactions.name} = ${c.name} AND ${transactions.date} = ${c.date} AND ${transactions.id} < ${c.id})
      )`;
    case "name_desc":
      return sql`(
        ${transactions.name} < ${c.name}
        OR (${transactions.name} = ${c.name} AND ${transactions.date} < ${c.date})
        OR (${transactions.name} = ${c.name} AND ${transactions.date} = ${c.date} AND ${transactions.id} < ${c.id})
      )`;
    case "category_asc":
      return sql`(
        ${transactions.category} > ${c.category}
        OR (${transactions.category} = ${c.category} AND ${transactions.date} < ${c.date})
        OR (${transactions.category} = ${c.category} AND ${transactions.date} = ${c.date} AND ${transactions.id} < ${c.id})
      )`;
    default: // date_desc
      return sql`(
        ${transactions.date} < ${c.date}
        OR (${transactions.date} = ${c.date} AND ${transactions.createdAt} < ${c.createdAt}::timestamptz)
      )`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function transactionUserFilter(userIds: string[]) {
  return userIds.length === 1
    ? eq(transactions.userId, userIds[0]!)
    : inArray(transactions.userId, userIds);
}

function sqlUserIdsIn(userIds: string[]) {
  if (userIds.length === 1) {
    return sql`user_id = ${userIds[0]!}`;
  }
  return sql`user_id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`;
}

export async function listTransactions(filters: {
  userIds: string[];
  month?: string;
  category?: string;
  subCategory?: string;
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
  const conditions = [transactionUserFilter(filters.userIds)];

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
  if (filters.subCategory) {
    if (filters.subCategory === GENERAL_SUBCATEGORY) {
      conditions.push(isNull(transactions.subCategory));
    } else {
      conditions.push(eq(transactions.subCategory, filters.subCategory));
    }
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

  // Decode and apply cursor for keyset pagination
  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor);
    if (decoded) {
      conditions.push(buildCursorCondition(decoded, filters.sort));
    }
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
      subCategory: transactions.subCategory,
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

  const lastRow = page[page.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({
          id: lastRow.id,
          date: lastRow.date,
          createdAt: lastRow.createdAt.toISOString(),
          amount: lastRow.amount,
          name: lastRow.name,
          category: lastRow.category,
        })
      : null;

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
        subCategory: row.subCategory ?? null,
        transactionType: row.transactionType as "expense" | "income" | "transfer",
        isTransfer: row.isTransfer,
        pending: row.pending,
        memberId: member?.memberId ?? null,
        memberName: member?.memberName ?? null,
        memberColor: member?.memberColor ?? null,
      };
    }),
    nextCursor,
  };
}

export async function getSummary(
  userIds: string[],
  from?: string,
  to?: string,
) {
  const db = getDb();
  const userFilter = sqlUserIdsIn(userIds);
  const dateFilter =
    from && to
      ? sql`date >= ${from} AND date <= ${to}`
      : sql`TRUE`;

  const spendRows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions
    WHERE ${userFilter}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND category != ${INTERNAL_TRANSFER_CATEGORY}
      AND pending = false
      AND ${dateFilter}
  `);

  const incomeRows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions
    WHERE ${userFilter}
      AND transaction_type = 'income'
      AND is_transfer = false
      AND pending = false
      AND ${dateFilter}
  `);

  const transferRows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions
    WHERE ${userFilter}
      AND is_transfer = true
      AND category = ${INTERNAL_TRANSFER_CATEGORY}
      AND sub_category = ${CREDIT_CARD_PAYMENT_SUBCATEGORY}
      AND pending = false
      AND ${dateFilter}
  `);

  const topCategoryRows = await db.execute<{
    name: string;
    amount: string;
  }>(sql`
    SELECT category AS name, SUM(ABS(amount::numeric))::text AS amount
    FROM transactions
    WHERE ${userFilter}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND category != ${INTERNAL_TRANSFER_CATEGORY}
      AND pending = false
      AND ${dateFilter}
    GROUP BY category
    ORDER BY SUM(ABS(amount::numeric)) DESC
    LIMIT 1
  `);

  const totalSpent = spendRows[0]?.total ?? "0.00";
  const income = incomeRows[0]?.total ?? "0.00";
  const ccPaymentsExcluded = transferRows[0]?.total ?? "0.00";
  const incomeNum = Number.parseFloat(income);
  const spentNum = Number.parseFloat(totalSpent);
  const net = incomeNum - spentNum;

  const txCountRows = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM transactions
    WHERE ${userFilter}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND category != ${INTERNAL_TRANSFER_CATEGORY}
      AND pending = false
      AND ${dateFilter}
  `);

  const pendingCountRows = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM transactions
    WHERE ${userFilter}
      AND pending = true
      AND ${dateFilter}
  `);

  const monthsInPeriod =
    from && to ? countMonthsInclusive(from, to) : 1;

  return {
    totalSpent: formatMoneyAmount(totalSpent),
    income: formatMoneyAmount(income),
    netSavings: formatMoneyAmount(net),
    avgMonthlySpend: formatMoneyAmount(spentNum / monthsInPeriod),
    topCategory: topCategoryRows[0]
      ? {
          name: topCategoryRows[0].name,
          amount: formatMoneyAmount(topCategoryRows[0].amount),
        }
      : { name: "None", amount: "0.00" },
    ccPaymentsExcluded: formatMoneyAmount(ccPaymentsExcluded),
    savingsRate: roundDecimal(incomeNum > 0 ? net / incomeNum : 0),
    transactionCount: Number.parseInt(txCountRows[0]?.count ?? "0", 10),
    pendingCount: Number.parseInt(pendingCountRows[0]?.count ?? "0", 10),
    monthsInPeriod,
  };
}

export async function getCategories(
  userIds: string[],
  from?: string,
  to?: string,
) {
  const db = getDb();
  const userFilter = sqlUserIdsIn(userIds);
  const dateFilter =
    from && to
      ? sql`date >= ${from} AND date <= ${to}`
      : sql`TRUE`;

  // Single query: group by category + sub_category to get both levels at once
  const rows = await db.execute<{
    category: string;
    sub_category: string | null;
    amount: string;
  }>(sql`
    SELECT
      category,
      sub_category,
      SUM(amount::numeric)::text AS amount
    FROM transactions
    WHERE ${userFilter}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND category != ${INTERNAL_TRANSFER_CATEGORY}
      AND ${dateFilter}
    GROUP BY category, sub_category
    ORDER BY category, SUM(amount::numeric) DESC
  `);

  // Aggregate category totals and nest subcategories
  const categoryMap = new Map<string, { amount: number; subs: Map<string, number> }>();
  for (const row of rows) {
    const existing = categoryMap.get(row.category) ?? { amount: 0, subs: new Map() };
    const rowAmount = Number.parseFloat(row.amount);
    existing.amount += rowAmount;
    if (row.sub_category) {
      existing.subs.set(
        row.sub_category,
        (existing.subs.get(row.sub_category) ?? 0) + rowAmount,
      );
    } else {
      existing.subs.set(
        GENERAL_SUBCATEGORY,
        (existing.subs.get(GENERAL_SUBCATEGORY) ?? 0) + rowAmount,
      );
    }
    categoryMap.set(row.category, existing);
  }

  const grandTotal = Array.from(categoryMap.values()).reduce(
    (sum, cat) => sum + cat.amount,
    0,
  );

  const categories = Array.from(categoryMap.entries())
    .sort(([, a], [, b]) => b.amount - a.amount)
    .map(([name, cat]) => {
      const catTotal = cat.amount;
      const subcategories = Array.from(cat.subs.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([subName, subAmount]) => ({
          name: subName,
          amount: formatMoneyAmount(subAmount),
          percentage: roundPercent(
            catTotal > 0 ? (subAmount / catTotal) * 100 : 0,
          ),
        }));

      return {
        name,
        amount: formatMoneyAmount(catTotal),
        percentage: roundPercent(
          grandTotal > 0 ? (catTotal / grandTotal) * 100 : 0,
        ),
        deltaVsPriorMonth: 0,
        subcategories,
      };
    });

  return { categories };
}

export async function getMoneyFlow(
  userIds: string[],
  from?: string,
  to?: string,
) {
  void from;
  void to;
  const db = getDb();
  const userFilter = sqlUserIdsIn(userIds);
  const tUserFilter =
    userIds.length === 1
      ? sql`t.user_id = ${userIds[0]!}`
      : sql`t.user_id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`;

  const incomeSources = await db.execute<{ label: string; amount: string }>(sql`
    SELECT name AS label, SUM(ABS(amount::numeric))::text AS amount
    FROM transactions
    WHERE ${userFilter}
      AND transaction_type = 'income' AND is_transfer = false
    GROUP BY name
    ORDER BY SUM(ABS(amount::numeric)) DESC
    LIMIT 10
  `);

  const bankAccounts = await db.execute<{ label: string; amount: string }>(sql`
    SELECT a.name AS label, SUM(ABS(t.amount::numeric))::text AS amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE ${tUserFilter}
      AND a.type = 'depository' AND t.transaction_type = 'expense' AND t.is_transfer = false
    GROUP BY a.name
  `);

  const creditCards = await db.execute<{ label: string; amount: string }>(sql`
    SELECT a.name AS label, SUM(t.amount::numeric)::text AS amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE ${tUserFilter}
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
    WHERE ${userFilter}
    GROUP BY date_trunc('month', date)
    ORDER BY month
  `);

  const incomeTotal = incomeSources.reduce(
    (s, r) => s + Number.parseFloat(r.amount),
    0,
  );
  const transferTotal = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions WHERE ${userFilter} AND is_transfer = true
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

export async function getTrends(
  userIds: string[],
  from?: string,
  to?: string,
) {
  void from;
  void to;
  const db = getDb();
  const userFilter = sqlUserIdsIn(userIds);

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
    WHERE ${userFilter}
      AND transaction_type = 'expense' AND NOT is_transfer
      AND category != ${INTERNAL_TRANSFER_CATEGORY}
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
  userIds: string[];
  from?: string;
  to?: string;
  accountId?: string;
  category?: string;
  scopedAccountIds?: string[] | null;
}

function buildChartFilters(params: ChartDataParams) {
  const userFilter =
    params.userIds.length === 1
      ? sql`t.user_id = ${params.userIds[0]!}`
      : sql`t.user_id IN (${sql.join(params.userIds.map((id) => sql`${id}`), sql`, `)})`;
  const parts = [userFilter, sql`t.pending = false`];
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
      COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' AND NOT t.is_transfer AND t.category != ${INTERNAL_TRANSFER_CATEGORY} THEN ABS(t.amount::numeric) ELSE 0 END), 0)::text AS expenses,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'income' AND NOT t.is_transfer THEN ABS(t.amount::numeric) ELSE 0 END), 0)::text AS income,
      COALESCE(SUM(
        CASE
          WHEN t.transaction_type = 'income' AND NOT t.is_transfer THEN ABS(t.amount::numeric)
          WHEN t.transaction_type = 'expense' AND NOT t.is_transfer AND t.category != ${INTERNAL_TRANSFER_CATEGORY} THEN -ABS(t.amount::numeric)
          ELSE 0
        END
      ), 0)::text AS net
    FROM transactions t
    WHERE ${whereClause}
    GROUP BY date_trunc('month', t.date)
    ORDER BY month
  `);

  const categoryRows = await db.execute<{ name: string; amount: string }>(sql`
    SELECT t.category AS name, SUM(ABS(t.amount::numeric))::text AS amount
    FROM transactions t
    WHERE ${whereClause}
      AND t.transaction_type = 'expense'
      AND NOT t.is_transfer
      AND t.category != ${INTERNAL_TRANSFER_CATEGORY}
    GROUP BY t.category
    ORDER BY SUM(ABS(t.amount::numeric)) DESC
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
    SELECT a.id, a.name, SUM(ABS(t.amount::numeric))::text AS amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE ${whereClause}
      AND t.transaction_type = 'expense'
      AND NOT t.is_transfer
      AND t.category != ${INTERNAL_TRANSFER_CATEGORY}
    GROUP BY a.id, a.name
    ORDER BY SUM(ABS(t.amount::numeric)) DESC
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
      COALESCE(SUM(ABS(t.amount::numeric)), 0)::text AS amount
    FROM transactions t
    JOIN household_account_assignments haa ON haa.account_id = t.account_id
    JOIN household_members hm ON hm.id = haa.member_id
    WHERE ${whereClause}
      AND t.transaction_type = 'expense'
      AND NOT t.is_transfer
      AND t.category != ${INTERNAL_TRANSFER_CATEGORY}
    GROUP BY hm.id, hm.display_name, hm.avatar_color
    ORDER BY SUM(ABS(t.amount::numeric)) DESC
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
      SUM(ABS(t.amount::numeric))::text AS amount
    FROM transactions t
    WHERE ${whereClause}
      AND t.transaction_type = 'expense'
      AND NOT t.is_transfer
      AND t.category != ${INTERNAL_TRANSFER_CATEGORY}
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

  let bySubCategory: { name: string; amount: string; percentage: number }[] = [];
  if (params.category) {
    const subRows = await db.execute<{
      sub_category: string | null;
      amount: string;
    }>(sql`
      SELECT
        t.sub_category,
        SUM(ABS(t.amount::numeric))::text AS amount
      FROM transactions t
      WHERE ${whereClause}
        AND t.transaction_type = 'expense'
        AND NOT t.is_transfer
        AND t.category = ${params.category}
      GROUP BY t.sub_category
      ORDER BY SUM(ABS(t.amount::numeric)) DESC
    `);
    const subTotal = subRows.reduce(
      (sum, row) => sum + Number.parseFloat(row.amount),
      0,
    );
    bySubCategory = subRows.map((row) => ({
      name: row.sub_category ?? GENERAL_SUBCATEGORY,
      amount: formatMoneyAmount(row.amount),
      percentage: roundPercent(
        subTotal > 0 ? (Number.parseFloat(row.amount) / subTotal) * 100 : 0,
      ),
    }));
  }

  return {
    monthly: monthly.map((row) => ({
      month: row.month,
      expenses: formatMoneyAmount(row.expenses),
      income: formatMoneyAmount(row.income),
      net: formatMoneyAmount(row.net),
    })),
    byCategory: categoryRows.map((row) => ({
      name: row.name,
      amount: formatMoneyAmount(row.amount),
      percentage: roundPercent(
        categoryTotal > 0
          ? (Number.parseFloat(row.amount) / categoryTotal) * 100
          : 0,
      ),
    })),
    bySubCategory,
    byAccount: accountRows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: formatMoneyAmount(row.amount),
      percentage: roundPercent(
        accountTotal > 0
          ? (Number.parseFloat(row.amount) / accountTotal) * 100
          : 0,
      ),
    })),
    byMember: memberRows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      amount: formatMoneyAmount(row.amount),
      percentage: roundPercent(
        memberTotal > 0
          ? (Number.parseFloat(row.amount) / memberTotal) * 100
          : 0,
      ),
    })),
    categoryTrends: categoryTrends.map((trend) => ({
      name: trend.name,
      months: trend.months.map((point) => ({
        month: point.month,
        amount: formatMoneyAmount(point.amount),
      })),
    })),
    totals: {
      expenses: formatMoneyAmount(expenseTotal),
      income: formatMoneyAmount(incomeTotal),
      net: formatMoneyAmount(incomeTotal - expenseTotal),
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
