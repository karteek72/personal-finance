import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { formatCsvRow } from "../lib/csv.js";
import { countMonthsInclusive, deltaPercentVsPrior, priorComparablePeriod } from "../lib/date-range.js";
import { seasonalCategoryDeltas } from "./category-seasonal-delta.js";
import { getPersistedAlerts } from "./alert-engine.js";
import { formatMoneyAmount, roundDecimal, roundPercent } from "../lib/money.js";
import {
  paginateInMemory,
  type Page,
  type ParsedListQuery,
} from "../lib/list-query.js";
import {
  metricNumericValue,
  savingsRateMetric,
} from "./metrics/index.js";
import {
  accounts,
  creditCardLiabilities,
  transactions,
} from "../db/schema.js";
import { getMemberMapForAccounts } from "./household-store.js";
import { getLiabilityMapForAccounts } from "./liability-store.js";
import {
  GENERAL_SUBCATEGORY,
} from "./infer-subcategory.js";
import { INTERNAL_TRANSFER_CATEGORY, CREDIT_CARD_PAYMENT_SUBCATEGORY } from "./transfer-classification.js";
import {
  getActiveAccountIds,
  sqlActiveAccountIdsIn,
} from "./active-account-scope.js";

function buildTransactionDateFilter(from?: string, to?: string) {
  return from && to
    ? sql`date >= ${from} AND date <= ${to}`
    : sql`TRUE`;
}

function buildTDateFilter(from?: string, to?: string) {
  return from && to
    ? sql`t.date >= ${from} AND t.date <= ${to}`
    : sql`TRUE`;
}

/** Rank trend categories by total spend (desc) before slicing. Exported for tests. */
export function rankTrendCategoriesBySpend(
  entries: Iterable<[string, { month: string; amount: string }[]]>,
  monthRows: Array<{ name: string; amount: string }>,
  limit = 8,
): Array<{ name: string; months: { month: string; amount: string }[] }> {
  const totals = new Map<string, number>();
  for (const row of monthRows) {
    totals.set(row.name, (totals.get(row.name) ?? 0) + Number.parseFloat(row.amount));
  }
  return [...entries]
    .sort(
      ([nameA], [nameB]) =>
        (totals.get(nameB) ?? 0) - (totals.get(nameA) ?? 0),
    )
    .slice(0, limit)
    .map(([name, months]) => ({ name, months }));
}

export async function listAccounts(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
    .orderBy(accounts.name);

  const memberMap = await getMemberMapForAccounts(rows.map((row) => row.id));
  const liabilityMap = await getLiabilityMapForAccounts(rows.map((row) => row.id));

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
        connectionProvider:
          row.source === "plaid" ||
          row.source === "teller" ||
          row.source === "snaptrade"
            ? (row.source as "plaid" | "teller" | "snaptrade")
            : row.source === "import"
              ? "import"
              : undefined,
        tellerEnrollmentId: row.tellerEnrollmentId,
        memberId: member?.memberId ?? null,
        memberName: member?.memberName ?? null,
        memberColor: member?.memberColor ?? null,
        liability:
          row.type === "credit" ? (liabilityMap.get(row.id) ?? null) : null,
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

async function activeTransactionSqlFilters(userIds: string[]) {
  const accountIds = await getActiveAccountIds(userIds);
  return {
    accountIds,
    userFilter: sqlUserIdsIn(userIds),
    accountFilter: sqlActiveAccountIdsIn(accountIds),
    tAccountFilter: sqlActiveAccountIdsIn(accountIds, "t.account_id"),
  };
}

export type TransactionListFilters = {
  userIds: string[];
  month?: string;
  category?: string;
  subCategory?: string;
  accountId?: string;
  scopedAccountIds?: string[] | null;
  q?: string;
  type?: string;
};

function buildTransactionFilterConditions(filters: TransactionListFilters) {
  const conditions = [transactionUserFilter(filters.userIds)];

  if (filters.scopedAccountIds !== undefined && filters.scopedAccountIds !== null) {
    if (filters.scopedAccountIds.length === 0) {
      return null;
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

  return conditions;
}

const CSV_EXPORT_HEADER =
  "date,name,merchant,amount,category,subCategory,account,type";

const CSV_EXPORT_BATCH_SIZE = 500;

export async function* streamTransactionsCsv(
  filters: TransactionListFilters & { sort?: TransactionSort },
): AsyncGenerator<string> {
  yield `${CSV_EXPORT_HEADER}\n`;

  const baseConditions = buildTransactionFilterConditions(filters);
  if (baseConditions === null) {
    return;
  }

  const db = getDb();
  const sort = filters.sort ?? "date_desc";
  let cursor: string | undefined;

  do {
    const conditions = [...baseConditions];
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        conditions.push(buildCursorCondition(decoded, sort));
      }
    }

    let query = db
      .select({
        id: transactions.id,
        date: transactions.date,
        name: transactions.name,
        merchantName: transactions.merchantName,
        amount: transactions.amount,
        category: transactions.category,
        subCategory: transactions.subCategory,
        accountName: accounts.name,
        transactionType: transactions.transactionType,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .orderBy(...transactionOrderBy(sort))
      .limit(CSV_EXPORT_BATCH_SIZE + 1);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query;
    const hasMore = rows.length > CSV_EXPORT_BATCH_SIZE;
    const page = hasMore ? rows.slice(0, CSV_EXPORT_BATCH_SIZE) : rows;

    for (const row of page) {
      yield `${formatCsvRow([
        row.date,
        row.name,
        row.merchantName ?? "",
        formatMoneyAmount(row.amount),
        row.category,
        row.subCategory ?? "",
        row.accountName,
        row.transactionType,
      ])}\n`;
    }

    const lastRow = page[page.length - 1];
    cursor =
      hasMore && lastRow
        ? encodeCursor({
            id: lastRow.id,
            date: lastRow.date,
            createdAt: lastRow.createdAt.toISOString(),
            amount: lastRow.amount,
            name: lastRow.name,
            category: lastRow.category,
          })
        : undefined;
  } while (cursor);
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
  const baseConditions = buildTransactionFilterConditions(filters);

  if (baseConditions === null) {
    return { items: [], nextCursor: null };
  }

  const conditions = [...baseConditions];

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
  const accountIds = await getActiveAccountIds(userIds);
  const userFilter = sqlUserIdsIn(userIds);
  const accountFilter = sqlActiveAccountIdsIn(accountIds);
  const dateFilter =
    from && to
      ? sql`date >= ${from} AND date <= ${to}`
      : sql`TRUE`;

  const spendRows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions
    WHERE ${userFilter}
      AND ${accountFilter}
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
      AND ${accountFilter}
      AND transaction_type = 'income'
      AND is_transfer = false
      AND pending = false
      AND ${dateFilter}
  `);

  const transferRows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions
    WHERE ${userFilter}
      AND ${accountFilter}
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
      AND ${accountFilter}
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
      AND ${accountFilter}
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
      AND ${accountFilter}
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
    savingsRate: metricNumericValue(
      savingsRateMetric({
        income: incomeNum,
        expense: spentNum,
        asOf: to ?? new Date().toISOString().slice(0, 10),
      }),
    ),
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
  const { userFilter, accountFilter } = await activeTransactionSqlFilters(userIds);
  const dateFilter = buildTransactionDateFilter(from, to);

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
      AND ${accountFilter}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND category != ${INTERNAL_TRANSFER_CATEGORY}
      AND ${dateFilter}
    GROUP BY category, sub_category
    ORDER BY category, SUM(amount::numeric) DESC
  `);

  let priorByCategory = new Map<string, number>();
  let seasonalDeltas = new Map<string, number>();
  const refMonth = from?.slice(0, 7) ?? to?.slice(0, 7);
  if (refMonth) {
    seasonalDeltas = await seasonalCategoryDeltas(userIds, refMonth);
  }
  if (from && to && seasonalDeltas.size === 0) {
    const { priorFrom, priorTo } = priorComparablePeriod(from, to);
    const priorFilter = buildTransactionDateFilter(priorFrom, priorTo);
    const priorRows = await db.execute<{ category: string; amount: string }>(sql`
      SELECT category, SUM(amount::numeric)::text AS amount
      FROM transactions
      WHERE ${userFilter}
        AND ${accountFilter}
        AND transaction_type = 'expense'
        AND is_transfer = false
        AND category != ${INTERNAL_TRANSFER_CATEGORY}
        AND ${priorFilter}
      GROUP BY category
    `);
    priorByCategory = new Map(
      priorRows.map((row) => [row.category, Number.parseFloat(row.amount)]),
    );
  }

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
        deltaVsPriorMonth: roundPercent(
          seasonalDeltas.get(name) ??
            deltaPercentVsPrior(catTotal, priorByCategory.get(name) ?? 0),
        ),
        subcategories,
      };
    });

  return { categories };
}

export interface FlowLine {
  label: string;
  amount: string;
}

export const FLOW_SOURCE_SORTABLE = ["label", "amount"] as const;

function flowLineSortKey(column: string): (row: FlowLine) => number | string {
  switch (column) {
    case "label":
      return (r) => r.label.toLowerCase();
    default:
      return (r) => Number.parseFloat(r.amount);
  }
}

export async function getMoneyFlow(
  userIds: string[],
  q: ParsedListQuery,
) {
  const db = getDb();
  const from = q.from;
  const to = q.to;
  const { userFilter, accountFilter, tAccountFilter } =
    await activeTransactionSqlFilters(userIds);
  const dateFilter = buildTransactionDateFilter(from, to);
  const tUserFilter =
    userIds.length === 1
      ? sql`t.user_id = ${userIds[0]!}`
      : sql`t.user_id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`;

  const incomeSourceRows = await db.execute<{ label: string; amount: string }>(sql`
    SELECT name AS label, SUM(ABS(amount::numeric))::text AS amount
    FROM transactions
    WHERE ${userFilter}
      AND ${accountFilter}
      AND transaction_type = 'income' AND is_transfer = false
      AND ${dateFilter}
    GROUP BY name
    ORDER BY SUM(ABS(amount::numeric)) DESC
  `);

  const incomeSources: Page<FlowLine> = paginateInMemory(
    incomeSourceRows.map((r) => ({
      label: r.label,
      amount: formatMoneyAmount(r.amount),
    })),
    q,
    {
      sortKey: flowLineSortKey,
      textFilter: (row, needle) => row.label.toLowerCase().includes(needle),
    },
  );

  const bankAccounts = await db.execute<{ label: string; amount: string }>(sql`
    SELECT a.name AS label, SUM(ABS(t.amount::numeric))::text AS amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE ${tUserFilter}
      AND ${tAccountFilter}
      AND a.is_active = true
      AND a.type = 'depository' AND t.transaction_type = 'expense' AND t.is_transfer = false
      AND ${buildTDateFilter(from, to)}
    GROUP BY a.name
  `);

  const creditCards = await db.execute<{ label: string; amount: string }>(sql`
    SELECT a.name AS label, SUM(t.amount::numeric)::text AS amount
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE ${tUserFilter}
      AND ${tAccountFilter}
      AND a.is_active = true
      AND a.type = 'credit' AND t.transaction_type = 'expense' AND t.is_transfer = false
      AND ${buildTDateFilter(from, to)}
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
      AND ${accountFilter}
      AND ${dateFilter}
    GROUP BY date_trunc('month', date)
    ORDER BY month
  `);

  const incomeTotal = incomeSourceRows.reduce(
    (s, r) => s + Number.parseFloat(r.amount),
    0,
  );
  const transferTotal = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(transfer_amount), 0)::text AS total
    FROM (
      SELECT date, ABS(amount::numeric) AS transfer_amount
      FROM transactions
      WHERE ${userFilter}
        AND ${accountFilter}
        AND is_transfer = true
        AND (sub_category IS NULL OR sub_category != ${CREDIT_CARD_PAYMENT_SUBCATEGORY})
        AND ${dateFilter}
      GROUP BY date, ABS(amount::numeric)
    ) paired_legs
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
  const db = getDb();
  const { userFilter, accountFilter } = await activeTransactionSqlFilters(userIds);
  const dateFilter = buildTransactionDateFilter(from, to);

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
      AND ${accountFilter}
      AND transaction_type = 'expense' AND NOT is_transfer
      AND category != ${INTERNAL_TRANSFER_CATEGORY}
      AND ${dateFilter}
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
    trends: rankTrendCategoriesBySpend(byCategory.entries(), rows),
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

/** When `dateRange` is null, no date filter is applied (used for bounds + yearly history). */
function buildChartFilters(
  params: ChartDataParams,
  dateRange?: { from: string; to: string } | null,
) {
  const userFilter =
    params.userIds.length === 1
      ? sql`t.user_id = ${params.userIds[0]!}`
      : sql`t.user_id IN (${sql.join(params.userIds.map((id) => sql`${id}`), sql`, `)})`;
  const parts = [userFilter, sql`t.pending = false`];
  const range =
    dateRange === null
      ? null
      : (dateRange ??
        (params.from && params.to
          ? { from: params.from, to: params.to }
          : null));
  if (range) {
    parts.push(sql`t.date >= ${range.from} AND t.date <= ${range.to}`);
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

const CHART_PERIOD_AGG_SQL = sql`
  COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' AND NOT t.is_transfer AND t.category != ${INTERNAL_TRANSFER_CATEGORY} THEN ABS(t.amount::numeric) ELSE 0 END), 0)::text AS expenses,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'income' AND NOT t.is_transfer THEN ABS(t.amount::numeric) ELSE 0 END), 0)::text AS income,
  COALESCE(SUM(
    CASE
      WHEN t.transaction_type = 'income' AND NOT t.is_transfer THEN ABS(t.amount::numeric)
      WHEN t.transaction_type = 'expense' AND NOT t.is_transfer AND t.category != ${INTERNAL_TRANSFER_CATEGORY} THEN -ABS(t.amount::numeric)
      ELSE 0
    END
  ), 0)::text AS net
`;

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
      ${CHART_PERIOD_AGG_SQL}
    FROM transactions t
    WHERE ${whereClause}
    GROUP BY date_trunc('month', t.date)
    ORDER BY month
  `);

  const boundsRows = await db.execute<{
    min_date: string | null;
    max_date: string | null;
  }>(sql`
    SELECT min(t.date)::text AS min_date, max(t.date)::text AS max_date
    FROM transactions t
    WHERE ${buildChartFilters(params, null)}
  `);

  let yearly: {
    year: string;
    expenses: string;
    income: string;
    net: string;
  }[] = [];

  const minDate = boundsRows[0]?.min_date;
  const maxDate = boundsRows[0]?.max_date;
  if (minDate && maxDate) {
    const minYear = Number.parseInt(minDate.slice(0, 4), 10);
    const maxYear = Number.parseInt(maxDate.slice(0, 4), 10);
    if (
      Number.isFinite(minYear) &&
      Number.isFinite(maxYear) &&
      maxYear > minYear
    ) {
      const yearlyRows = await db.execute<{
        year: string;
        expenses: string;
        income: string;
        net: string;
      }>(sql`
        SELECT
          to_char(date_trunc('year', t.date), 'YYYY') AS year,
          ${CHART_PERIOD_AGG_SQL}
        FROM transactions t
        WHERE ${buildChartFilters(params, { from: minDate, to: maxDate })}
        GROUP BY date_trunc('year', t.date)
        ORDER BY year
      `);
      yearly = yearlyRows;
    }
  }

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
    yearly: yearly.map((row) => ({
      year: row.year,
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

type AlertSeverity = "warning" | "info";

interface SpendingAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  dismissible: boolean;
}

function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split("-");
  const lastDay = new Date(Number.parseInt(year!, 10), Number.parseInt(mon!, 10), 0)
    .getDate();
  return {
    from: `${year}-${mon}-01`,
    to: `${year}-${mon}-${String(lastDay).padStart(2, "0")}`,
  };
}

function priorMonth(month: string): string {
  const [yearStr, monStr] = month.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  const mon = Number.parseInt(monStr ?? "", 10);
  const date = new Date(year, mon - 2, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function categorySpendByMonth(
  userIds: string[],
  month: string,
  category: string,
): Promise<number> {
  const db = getDb();
  const { from, to } = monthBounds(month);
  const { userFilter, accountFilter } = await activeTransactionSqlFilters(userIds);
  const rows = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
    FROM transactions
    WHERE ${userFilter}
      AND ${accountFilter}
      AND transaction_type = 'expense'
      AND is_transfer = false
      AND category = ${category}
      AND pending = false
      AND date >= ${from}
      AND date <= ${to}
  `);
  return Number.parseFloat(rows[0]?.total ?? "0");
}

export async function getAlerts(
  userIds: string[],
  month?: string,
): Promise<{ alerts: SpendingAlert[] }> {
  const ownerId = userIds[0];
  if (ownerId) {
    const persisted = await getPersistedAlerts(ownerId);
    if (persisted.length > 0) {
      return {
        alerts: persisted.map((a) => ({
          id: a.id,
          severity: (a.severity === "danger" ? "warning" : a.severity) as AlertSeverity,
          title: a.title,
          message: a.message,
          dismissible: a.dismissible,
        })),
      };
    }
  }

  const db = getDb();
  const alerts: SpendingAlert[] = [];
  const refMonth = month ?? "2026-05";
  const prevMonth = priorMonth(refMonth);

  const watchCategories = [
    "Dining & Restaurants",
    "Subscriptions & Software",
  ] as const;

  for (const category of watchCategories) {
    const current = await categorySpendByMonth(userIds, refMonth, category);
    const previous = await categorySpendByMonth(userIds, prevMonth, category);
    if (previous <= 0 || current <= previous) {
      continue;
    }
    const pct = Math.round(((current - previous) / previous) * 100);
    alerts.push({
      id: `alert-spend-${category.toLowerCase().replace(/\s+/g, "-")}`,
      severity: pct >= 15 ? "warning" : "info",
      title: `${category} spend up ${pct}%`,
      message: `You spent ${formatMoneyAmount(current)} on ${category} in ${refMonth}, up ${pct}% from ${prevMonth} (${formatMoneyAmount(previous)}).`,
      dismissible: true,
    });
  }

  const { userFilter, accountFilter } = await activeTransactionSqlFilters(userIds);
  const { from, to } = monthBounds(refMonth);
  const pendingRows = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM transactions
    WHERE ${userFilter}
      AND ${accountFilter}
      AND pending = true
      AND date >= ${from}
      AND date <= ${to}
  `);
  const pendingCount = Number.parseInt(pendingRows[0]?.count ?? "0", 10);
  if (pendingCount > 0) {
    alerts.push({
      id: "alert-pending-transactions",
      severity: "info",
      title: `${pendingCount} pending transaction${pendingCount === 1 ? "" : "s"}`,
      message: `There ${pendingCount === 1 ? "is" : "are"} ${pendingCount} pending charge${pendingCount === 1 ? "" : "s"} this month that are not included in spend totals yet.`,
      dismissible: true,
    });
  }

  const overdueRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creditCardLiabilities)
    .innerJoin(accounts, eq(accounts.id, creditCardLiabilities.accountId))
    .where(
      and(
        inArray(accounts.userId, userIds),
        eq(creditCardLiabilities.isOverdue, true),
      ),
    );

  const overdueCount = overdueRows[0]?.count ?? 0;
  if (overdueCount > 0) {
    alerts.push({
      id: "alert-overdue-card",
      severity: "warning",
      title: "Credit card payment overdue",
      message: `${overdueCount} linked card${overdueCount === 1 ? " has" : "s have"} an overdue statement balance. Pay at least the minimum to avoid fees.`,
      dismissible: true,
    });
  }

  return { alerts };
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
