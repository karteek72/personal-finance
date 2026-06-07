import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, balanceSnapshots } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";

export interface BalanceSnapshotInput {
  accountId: string;
  balanceCurrent: string | null;
  balanceAvailable: string | null;
  creditLimit?: string | null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Idempotent upsert of daily balance snapshots (one row per account per date). */
export async function upsertBalanceSnapshots(
  snapshots: BalanceSnapshotInput[],
  asOfDate?: string,
): Promise<void> {
  if (snapshots.length === 0) return;

  const db = getDb();
  const date = asOfDate ?? todayIsoDate();

  for (const snapshot of snapshots) {
    await db
      .insert(balanceSnapshots)
      .values({
        accountId: snapshot.accountId,
        asOfDate: date,
        balanceCurrent: snapshot.balanceCurrent,
        balanceAvailable: snapshot.balanceAvailable,
        creditLimit: snapshot.creditLimit ?? null,
      })
      .onConflictDoUpdate({
        target: [balanceSnapshots.accountId, balanceSnapshots.asOfDate],
        set: {
          balanceCurrent: snapshot.balanceCurrent,
          balanceAvailable: snapshot.balanceAvailable,
          creditLimit: snapshot.creditLimit ?? null,
        },
      });
  }
}

export async function upsertBalanceSnapshotsForAccountIds(
  accountIds: string[],
  asOfDate?: string,
): Promise<void> {
  if (accountIds.length === 0) return;

  const db = getDb();
  const rows = await db
    .select({
      id: accounts.id,
      balanceCurrent: accounts.balanceCurrent,
      balanceAvailable: accounts.balanceAvailable,
      creditLimit: accounts.creditLimit,
    })
    .from(accounts)
    .where(inArray(accounts.id, accountIds));

  await upsertBalanceSnapshots(
    rows.map((row) => ({
      accountId: row.id,
      balanceCurrent: row.balanceCurrent,
      balanceAvailable: row.balanceAvailable,
      creditLimit: row.creditLimit,
    })),
    asOfDate,
  );
}

export interface NetWorthTrendPoint {
  month: string;
  netWorth: string;
}

/** Monthly net worth from the latest per-account snapshot in each calendar month. */
export async function getNetWorthTrendFromBalanceSnapshots(
  userIds: string[],
): Promise<NetWorthTrendPoint[]> {
  if (userIds.length === 0) return [];

  const db = getDb();
  const result = await db.execute<{
    month: string;
    assets: string;
    liabilities: string;
  }>(sql`
    WITH scoped AS (
      SELECT
        bs.account_id,
        bs.as_of_date,
        bs.balance_current,
        a.type,
        to_char(bs.as_of_date, 'YYYY-MM') AS month
      FROM balance_snapshots bs
      INNER JOIN accounts a ON a.id = bs.account_id
      WHERE a.user_id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})
        AND a.is_active = true
    ),
    ranked AS (
      SELECT
        month,
        type,
        balance_current,
        ROW_NUMBER() OVER (
          PARTITION BY account_id, month
          ORDER BY as_of_date DESC
        ) AS rn
      FROM scoped
    ),
    latest AS (
      SELECT month, type, balance_current
      FROM ranked
      WHERE rn = 1
    )
    SELECT
      month,
      coalesce(sum(case when type != 'credit' then balance_current::numeric else 0 end), 0)::text AS assets,
      coalesce(sum(case when type = 'credit' then balance_current::numeric else 0 end), 0)::text AS liabilities
    FROM latest
    GROUP BY month
    ORDER BY month
  `);

  return result.map((row) => {
    const assets = Number.parseFloat(row.assets ?? "0");
    const liabilities = Number.parseFloat(row.liabilities ?? "0");
    return {
      month: row.month,
      netWorth: formatMoneyAmount(assets - liabilities),
    };
  });
}

export interface AccountMetricsSnapshot {
  liquidCash: number;
  creditBalance: number;
  creditLimit: number;
  hasCreditLimit: boolean;
  /** True when at least one account had a snapshot on or before asOfDate. */
  hasSnapshot: boolean;
}

function aggregateAccountMetrics(
  rows: Array<{
    type: string;
    balanceAvailable: string | null;
    balanceCurrent: string | null;
    creditLimit: string | null;
  }>,
  fromSnapshot: boolean,
): AccountMetricsSnapshot {
  let liquidCash = 0;
  let creditBalance = 0;
  let creditLimit = 0;
  let hasCreditLimit = false;

  for (const row of rows) {
    if (row.type === "depository") {
      liquidCash += Number.parseFloat(
        row.balanceAvailable ?? row.balanceCurrent ?? "0",
      );
    } else if (row.type === "credit") {
      const bal = Math.abs(Number.parseFloat(row.balanceCurrent ?? "0"));
      creditBalance += bal;
      const limit = Number.parseFloat(row.creditLimit ?? "0");
      if (limit > 0) {
        creditLimit += limit;
        hasCreditLimit = true;
      }
    }
  }

  return {
    liquidCash,
    creditBalance,
    creditLimit,
    hasCreditLimit,
    hasSnapshot: fromSnapshot,
  };
}

/**
 * Account balances as of a date from balance_snapshots (latest row per account ≤ asOfDate).
 * Falls back to live account balances when no snapshot exists, with hasSnapshot=false.
 */
export async function getAccountMetricsAsOf(
  userIds: string[],
  asOfDate: string,
): Promise<AccountMetricsSnapshot> {
  if (userIds.length === 0) {
    return {
      liquidCash: 0,
      creditBalance: 0,
      creditLimit: 0,
      hasCreditLimit: false,
      hasSnapshot: false,
    };
  }

  const db = getDb();
  const snapshotRows = await db.execute<{
    type: string;
    balance_available: string | null;
    balance_current: string | null;
    credit_limit: string | null;
  }>(sql`
    WITH scoped AS (
      SELECT
        bs.account_id,
        bs.as_of_date,
        bs.balance_current,
        bs.balance_available,
        bs.credit_limit,
        a.type
      FROM balance_snapshots bs
      INNER JOIN accounts a ON a.id = bs.account_id
      WHERE a.user_id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})
        AND a.is_active = true
        AND bs.as_of_date <= ${asOfDate}
    ),
    ranked AS (
      SELECT
        type,
        balance_current,
        balance_available,
        credit_limit,
        ROW_NUMBER() OVER (
          PARTITION BY account_id
          ORDER BY as_of_date DESC
        ) AS rn
      FROM scoped
    )
    SELECT
      type,
      balance_available,
      balance_current,
      credit_limit
    FROM ranked
    WHERE rn = 1
  `);

  if (snapshotRows.length > 0) {
    return aggregateAccountMetrics(
      snapshotRows.map((row) => ({
        type: row.type,
        balanceAvailable: row.balance_available,
        balanceCurrent: row.balance_current,
        creditLimit: row.credit_limit,
      })),
      true,
    );
  }

  const liveRows = await db
    .select({
      type: accounts.type,
      balanceAvailable: accounts.balanceAvailable,
      balanceCurrent: accounts.balanceCurrent,
      creditLimit: accounts.creditLimit,
    })
    .from(accounts)
    .where(and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)));

  return aggregateAccountMetrics(liveRows, false);
}

/** Remove balance snapshots when purging derived data for deleted accounts. */
export async function deleteBalanceSnapshotsForAccounts(
  accountIds: string[],
): Promise<void> {
  if (accountIds.length === 0) return;
  const db = getDb();
  await db
    .delete(balanceSnapshots)
    .where(inArray(balanceSnapshots.accountId, accountIds));
}
