import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  alertRules,
  creditCardLiabilities,
  dimCategory,
  investmentTransactions,
  recurringSeries,
  transactions,
  userAlerts,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { subscriptionLaneForMerchant } from "./analytics-categories.js";
import { resolveHouseholdContext } from "./household-access.js";
import { detectHiddenFees } from "./fee-detection.js";
import {
  computeEmergencyMonths,
  trailingEssentialOutflow,
} from "./metrics/index.js";
import { replayFifoTaxLots, type TaxLotTxnInput } from "./investment/fifo-tax-lots.js";
import { getDataQuality } from "./data-quality.js";

export interface AlertEvidence {
  transactionIds?: string[];
  investmentTxnIds?: string[];
  recurringIds?: string[];
  accountIds?: string[];
  details?: Record<string, string | number | boolean>;
}

export interface EvaluatedAlert {
  ruleId: string;
  severity: string;
  title: string;
  message: string;
  basis: "factual" | "heuristic" | "external";
  confidence: number;
  dismissible: boolean;
  evidence?: AlertEvidence;
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

async function sumDepositoryCash(userIds: string[]): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      balance: accounts.balanceAvailable,
      current: accounts.balanceCurrent,
    })
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, userIds),
        eq(accounts.type, "depository"),
        eq(accounts.isActive, true),
      ),
    );
  let total = 0;
  for (const row of rows) {
    total += Number.parseFloat(row.balance ?? row.current ?? "0");
  }
  return total;
}

async function evaluatePriceCreep(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        inArray(recurringSeries.userId, userIds),
        eq(recurringSeries.priceChanged, true),
        eq(recurringSeries.status, "active"),
      ),
    );

  if (rows.length === 0) return null;
  const names = rows.slice(0, 3).map((r) => r.merchantName).join(", ");
  return {
    ruleId: "price_creep",
    severity: "warning",
    title: "Subscription price increases detected",
    message: `${rows.length} recurring charge${rows.length === 1 ? "" : "s"} increased recently (${names}${rows.length > 3 ? ", …" : ""}). Review renewals.`,
    basis: "factual",
    confidence: 0.9,
    dismissible: true,
    evidence: { recurringIds: rows.map((r) => r.id) },
  };
}

async function evaluateZombieSubscriptions(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        inArray(recurringSeries.userId, userIds),
        eq(recurringSeries.status, "cancelled"),
      ),
    );

  if (rows.length === 0) return null;
  return {
    ruleId: "zombie_subscription",
    severity: "info",
    title: "Possibly cancelled subscriptions",
    message: `${rows.length} recurring series ha${rows.length === 1 ? "s" : "ve"} gone silent — confirm cancellations to stop counting them.`,
    basis: "factual",
    confidence: 0.85,
    dismissible: true,
    evidence: { recurringIds: rows.map((r) => r.id) },
  };
}

async function evaluateDuplicateSubscriptions(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        inArray(recurringSeries.userId, userIds),
        eq(recurringSeries.status, "active"),
      ),
    );

  const lanes = new Map<string, string[]>();
  for (const row of rows) {
    const lane = subscriptionLaneForMerchant(row.merchantName);
    if (!lane) continue;
    const list = lanes.get(lane) ?? [];
    list.push(row.merchantName);
    lanes.set(lane, list);
  }

  for (const [lane, merchants] of lanes) {
    if (merchants.length >= 2) {
      return {
        ruleId: "duplicate_subscription",
        severity: "warning",
        title: "Overlapping subscriptions",
        message: `Multiple active ${lane.replace(/-/g, " ")} services (${merchants.join(", ")}). Consider consolidating.`,
        basis: "heuristic",
        confidence: 0.7,
        dismissible: true,
        evidence: { details: { lane, count: merchants.length } },
      };
    }
  }
  return null;
}

async function evaluateFees(
  userIds: string[],
  ruleId: "overdraft_fee" | "atm_fee",
): Promise<EvaluatedAlert | null> {
  const fees = await detectHiddenFees(userIds);
  const match = fees.find((f) =>
    ruleId === "overdraft_fee" ? f.id === "overdraft" : f.id === "atm",
  );
  if (!match || match.count === 0) return null;

  return {
    ruleId,
    severity: ruleId === "overdraft_fee" ? "warning" : "info",
    title: match.label,
    message: `${match.count} ${match.label.toLowerCase()} totaling ${match.total} in the last 12 months.`,
    basis: "factual",
    confidence: 0.95,
    dismissible: true,
    evidence: { details: { count: match.count, total: match.total } },
  };
}

async function evaluateUtilizationSpike(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const rows = await db
    .select({
      name: accounts.name,
      balance: accounts.balanceCurrent,
      limit: accounts.creditLimit,
    })
    .from(creditCardLiabilities)
    .innerJoin(accounts, eq(creditCardLiabilities.accountId, accounts.id))
    .where(and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)));

  for (const row of rows) {
    const limit = Number.parseFloat(row.limit ?? "0");
    const balance = Math.abs(Number.parseFloat(row.balance ?? "0"));
    if (limit <= 0) continue;
    const util = balance / limit;
    if (util >= 0.7) {
      return {
        ruleId: "utilization_spike",
        severity: "warning",
        title: "High credit utilization",
        message: `${row.name} is at ${Math.round(util * 100)}% utilization (${formatMoneyAmount(balance)} of ${formatMoneyAmount(limit)}).`,
        basis: "factual",
        confidence: 0.95,
        dismissible: true,
        evidence: { details: { utilization: roundDecimal(util * 100) } },
      };
    }
  }
  return null;
}

async function evaluateEmergencyFund(userIds: string[]): Promise<EvaluatedAlert | null> {
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) return null;

  const asOf = new Date().toISOString().slice(0, 10);
  const liquidCash = await sumDepositoryCash(userIds);
  const trailing = await trailingEssentialOutflow(userIds, accountIds, asOf, 3);
  const burn = trailing.total / Math.max(trailing.months, 1);
  const months = computeEmergencyMonths({ liquidReserves: liquidCash, essentialBurnRate: burn });

  if (months >= 3) return null;

  return {
    ruleId: "ef_breach",
    severity: "warning",
    title: "Emergency fund below 3 months",
    message: `Liquid reserves cover about ${roundDecimal(months, 1)} months of essential spending (target: 3+).`,
    basis: "factual",
    confidence: 0.85,
    dismissible: true,
    evidence: { details: { emergencyMonths: roundDecimal(months, 1) } },
  };
}

async function evaluateRunway(userIds: string[]): Promise<EvaluatedAlert | null> {
  const alert = await evaluateEmergencyFund(userIds);
  if (!alert) return null;
  return {
    ...alert,
    ruleId: "runway_low",
    title: "Runway below 3 months",
    message: alert.message.replace("Emergency fund", "Runway"),
  };
}

async function evaluateLifestyleInflation(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) return null;

  const since = monthsAgo(6);
  const discretionaryCats = await db
    .select({ category: dimCategory.category })
    .from(dimCategory)
    .where(eq(dimCategory.spendClass, "discretionary"));

  const discNames = discretionaryCats.map((c) => c.category);
  if (discNames.length === 0) return null;

  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        inArray(transactions.category, discNames),
        gte(transactions.date, since),
      ),
    )
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

  if (rows.length < 3) return null;

  const sorted = rows
    .map((r) => ({ month: r.month, total: Number.parseFloat(r.total ?? "0") }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
  const avgFirst =
    firstHalf.reduce((s, r) => s + r.total, 0) / Math.max(firstHalf.length, 1);
  const avgSecond =
    secondHalf.reduce((s, r) => s + r.total, 0) / Math.max(secondHalf.length, 1);

  if (avgFirst <= 0 || avgSecond <= avgFirst * 1.15) return null;

  const pct = Math.round(((avgSecond - avgFirst) / avgFirst) * 100);

  return {
    ruleId: "lifestyle_inflation",
    severity: "info",
    title: "Discretionary spend trending up",
    message: `Discretionary spending rose ~${pct}% in recent months.`,
    basis: "heuristic",
    confidence: 0.55,
    dismissible: true,
    evidence: { details: { deltaPct: pct } },
  };
}

async function evaluateBillCluster(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const today = new Date();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 14);

  const rows = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        inArray(recurringSeries.userId, userIds),
        eq(recurringSeries.status, "active"),
        sql`${recurringSeries.nextChargeDate} IS NOT NULL`,
        sql`${recurringSeries.nextChargeDate} >= ${today.toISOString().slice(0, 10)}`,
        sql`${recurringSeries.nextChargeDate} <= ${horizon.toISOString().slice(0, 10)}`,
      ),
    );

  if (rows.length < 3) return null;
  const total = rows.reduce((s, r) => s + Number.parseFloat(r.amount), 0);

  return {
    ruleId: "bill_cluster_dip",
    severity: "info",
    title: "Upcoming bill cluster",
    message: `${rows.length} recurring bills (${formatMoneyAmount(total)}) due in the next 14 days — plan cash accordingly.`,
    basis: "heuristic",
    confidence: 0.6,
    dismissible: true,
    evidence: { recurringIds: rows.map((r) => r.id) },
  };
}

async function evaluateWashSaleRisk(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: investmentTransactions.id,
      accountId: investmentTransactions.accountId,
      securityId: investmentTransactions.securityId,
      date: investmentTransactions.date,
      type: investmentTransactions.type,
      quantity: investmentTransactions.quantity,
      price: investmentTransactions.price,
      amount: investmentTransactions.amount,
    })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.userId, userIds),
        inArray(investmentTransactions.type, ["buy", "sell"]),
      ),
    )
    .orderBy(investmentTransactions.date);

  const txns: TaxLotTxnInput[] = rows
    .filter((r) => r.securityId)
    .map((r) => ({
      id: r.id,
      accountId: r.accountId,
      securityId: r.securityId!,
      date: r.date,
      type: r.type as "buy" | "sell",
      quantity: Number.parseFloat(r.quantity ?? "0"),
      price: Number.parseFloat(r.price ?? "0"),
      amount: Number.parseFloat(r.amount),
    }));

  const { realizedSales } = replayFifoTaxLots(txns);
  const washSales = realizedSales.filter((s) => s.washSale && s.gainLoss < 0);
  if (washSales.length === 0) return null;

  return {
    ruleId: "wash_sale_risk",
    severity: "info",
    title: "Wash-sale risk detected",
    message: `${washSales.length} realized loss${washSales.length === 1 ? "" : "es"} may be disallowed due to repurchase within 30 days.`,
    basis: "heuristic",
    confidence: 0.75,
    dismissible: true,
    evidence: { investmentTxnIds: washSales.map((s) => s.txnId) },
  };
}

async function evaluateIdleCash(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const investAccounts = await db
    .select({ balance: accounts.balanceCurrent })
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, userIds),
        eq(accounts.isActive, true),
        sql`${accounts.type} in ('investment', 'brokerage')`,
      ),
    );

  if (investAccounts.length === 0) return null;

  let totalCash = 0;
  for (const acct of investAccounts) {
    totalCash += Number.parseFloat(acct.balance ?? "0");
  }

  const holdingRows = await db.execute<{ value: string }>(sql`
    SELECT coalesce(sum(market_value::numeric), 0)::text AS value
    FROM holdings_snapshots hs
    INNER JOIN accounts a ON a.id = hs.account_id
    WHERE a.user_id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})
      AND hs.as_of_date = (
        SELECT max(h2.as_of_date) FROM holdings_snapshots h2 WHERE h2.account_id = hs.account_id
      )
  `);

  const holdingsValue = Number.parseFloat(holdingRows[0]?.value ?? "0");
  const totalValue = totalCash + holdingsValue;
  if (totalValue <= 0) return null;

  const cashShare = totalCash / totalValue;
  if (cashShare < 0.15) return null;

  return {
    ruleId: "idle_cash_drag",
    severity: "info",
    title: "Idle cash in brokerage",
    message: `${Math.round(cashShare * 100)}% of portfolio value is uninvested cash — consider deploying per your plan.`,
    basis: "heuristic",
    confidence: 0.65,
    dismissible: true,
    evidence: { details: { cashShare: roundDecimal(cashShare, 2) } },
  };
}

async function evaluateStaleSync(userIds: string[]): Promise<EvaluatedAlert | null> {
  const db = getDb();
  const rows = await db
    .select({ name: accounts.name, lastSynced: accounts.lastSyncedAt })
    .from(accounts)
    .where(and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)));

  const now = Date.now();
  const stale = rows.filter((r) => {
    if (!r.lastSynced) return true;
    const days = (now - r.lastSynced.getTime()) / (1000 * 60 * 60 * 24);
    return days > 7;
  });

  if (stale.length === 0) return null;
  return {
    ruleId: "stale_sync",
    severity: "warning",
    title: "Stale account sync",
    message: `${stale.length} linked account${stale.length === 1 ? "" : "s"} not synced in 7+ days (${stale[0]!.name}${stale.length > 1 ? ", …" : ""}).`,
    basis: "factual",
    confidence: 0.9,
    dismissible: true,
  };
}

async function evaluateReconciliationGap(userId: string): Promise<EvaluatedAlert | null> {
  const quality = await getDataQuality(userId);
  const gap = Number.parseFloat(quality.reconciliationGap.value);
  if (gap < 0.05) return null;

  return {
    ruleId: "reconciliation_gap",
    severity: "warning",
    title: "Reconciliation gap detected",
    message: `Transaction totals diverge from balance changes by ~${Math.round(gap * 100)}% — review imports and categorization.`,
    basis: "heuristic",
    confidence: quality.compositeConfidence,
    dismissible: true,
    evidence: { details: { gapPct: roundDecimal(gap * 100) } },
  };
}

/** Evaluate all enabled alert rules for a household owner. */
export async function evaluateUserAlerts(userId: string): Promise<EvaluatedAlert[]> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const rules = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true));

  const enabledIds = new Set(rules.map((r) => r.id));
  const alerts: EvaluatedAlert[] = [];

  const evaluators: Array<(userIds: string[]) => Promise<EvaluatedAlert | null>> = [
    evaluatePriceCreep,
    evaluateZombieSubscriptions,
    evaluateDuplicateSubscriptions,
    (ids) => evaluateFees(ids, "overdraft_fee"),
    (ids) => evaluateFees(ids, "atm_fee"),
    evaluateUtilizationSpike,
    evaluateEmergencyFund,
    evaluateRunway,
    evaluateLifestyleInflation,
    evaluateBillCluster,
    evaluateWashSaleRisk,
    evaluateIdleCash,
    evaluateStaleSync,
  ];

  for (const evaluate of evaluators) {
    const result = await evaluate(ctx.userIds);
    if (result && enabledIds.has(result.ruleId)) {
      alerts.push(result);
    }
  }

  const reconAlert = await evaluateReconciliationGap(userId);
  if (reconAlert && enabledIds.has(reconAlert.ruleId)) {
    alerts.push(reconAlert);
  }

  for (const alert of alerts) {
    await db
      .insert(userAlerts)
      .values({
        userId,
        ruleId: alert.ruleId,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        basis: alert.basis,
        confidence: String(alert.confidence),
        evidenceJson: alert.evidence ?? null,
        dismissible: alert.dismissible,
        dismissed: false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userAlerts.userId, userAlerts.ruleId],
        set: {
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          basis: alert.basis,
          confidence: String(alert.confidence),
          evidenceJson: alert.evidence ?? null,
          dismissed: false,
          updatedAt: new Date(),
          triggeredAt: new Date(),
        },
      });
  }

  const activeRuleIds = alerts.map((a) => a.ruleId);
  if (activeRuleIds.length > 0) {
    await db
      .delete(userAlerts)
      .where(
        and(
          eq(userAlerts.userId, userId),
          eq(userAlerts.dismissed, false),
          sql`${userAlerts.ruleId} NOT IN (${sql.join(activeRuleIds.map((id) => sql`${id}`), sql`, `)})`,
        ),
      );
  }

  return alerts;
}

/** Fetch persisted non-dismissed alerts for the notifications surface. */
export async function getPersistedAlerts(userId: string): Promise<
  Array<{
    id: string;
    ruleId: string;
    severity: string;
    title: string;
    message: string;
    basis: string;
    confidence: number | null;
    dismissible: boolean;
    evidence?: AlertEvidence;
  }>
> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userAlerts)
    .where(and(eq(userAlerts.userId, userId), eq(userAlerts.dismissed, false)))
    .orderBy(sql`${userAlerts.triggeredAt} desc`);

  return rows.map((row) => ({
    id: row.id,
    ruleId: row.ruleId,
    severity: row.severity,
    title: row.title,
    message: row.message,
    basis: row.basis,
    confidence: row.confidence ? Number.parseFloat(row.confidence) : null,
    dismissible: row.dismissible,
    evidence: row.evidenceJson as AlertEvidence | undefined,
  }));
}
