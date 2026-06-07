import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  holdings,
  plaidItems,
  tellerEnrollments,
  transactions,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import {
  buildMetricEnvelope,
  type MetricEnvelope,
} from "./metrics/types.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";
import {
  transferPairCoverage,
  unpairedTransferLikeOutflows,
} from "./transfer-pairing.js";
import {
  getCrossProviderDuplicateReport,
  type CrossProviderDuplicateReport,
} from "./cross-provider-duplicates.js";

export interface DataQualityResponse {
  categorizationCoverage: MetricEnvelope;
  syncFreshness: MetricEnvelope;
  transferPairCoverage: MetricEnvelope;
  reconciliationGap: MetricEnvelope;
  pendingRatio: MetricEnvelope;
  costBasisCompleteness: MetricEnvelope;
  compositeConfidence: number;
  isLive: boolean;
  crossProviderDuplicates: CrossProviderDuplicateReport;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function confidenceFromCoverage(ratio: number): number {
  return roundDecimal(Math.max(0, Math.min(1, ratio)), 2);
}

/** Weighted blend of quality signals — conservative composite. */
export function compositeDataQualityConfidence(signals: {
  categorization: number;
  syncFreshness: number;
  transferPairs: number;
  reconciliation: number;
  pending: number;
  costBasis: number;
}): number {
  const weights = {
    categorization: 0.25,
    syncFreshness: 0.15,
    transferPairs: 0.1,
    reconciliation: 0.2,
    pending: 0.15,
    costBasis: 0.15,
  };
  let weighted = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const value = signals[key as keyof typeof signals];
    weighted += value * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? roundDecimal(weighted / totalWeight, 2) : 0;
}

/** Scale metric envelope confidence by composite data-quality score. */
export function applyDataQualityConfidence(
  envelope: MetricEnvelope,
  compositeConfidence: number,
): MetricEnvelope {
  return {
    ...envelope,
    confidence: roundDecimal(envelope.confidence * compositeConfidence, 2),
  };
}

export async function getDataQuality(userId: string): Promise<DataQualityResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );
  const asOf = new Date().toISOString().slice(0, 10);

  if (!hasActiveAccounts) {
    const empty = buildMetricEnvelope({
      value: 0,
      unit: "ratio",
      asOf,
      class: "descriptive",
      basis: "factual",
      confidence: 0,
      caveats: ["No linked accounts"],
    });
    return {
      categorizationCoverage: empty,
      syncFreshness: empty,
      transferPairCoverage: empty,
      reconciliationGap: empty,
      pendingRatio: empty,
      costBasisCompleteness: empty,
      compositeConfidence: 0,
      isLive: false,
      crossProviderDuplicates: {
        duplicateAccountPairs: [],
        duplicateTransactionCount: 0,
        duplicateTransactionsSample: [],
        mergePath: "POST /api/v1/accounts/merge-provider-duplicates",
        dismissPath: "POST /api/v1/accounts/duplicate-pairs/dismiss",
      },
    };
  }

  const db = getDb();
  const txScope = drizzleActiveTransactionWhere(ctx.userIds, accountIds);

  const [spendRow] = await db
    .select({
      totalSpend: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false and ${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY} then ${transactions.amount}::numeric else 0 end), 0)`,
      uncategorizedSpend: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false and ${transactions.category} = 'Uncategorized' then ${transactions.amount}::numeric else 0 end), 0)`,
      pendingCount: sql<string>`coalesce(sum(case when ${transactions.pending} = true then 1 else 0 end), 0)`,
      totalCount: sql<string>`count(*)`,
      transferOutCount: sql<string>`coalesce(sum(case when ${transactions.isTransfer} = true and ${transactions.transactionType} = 'expense' then 1 else 0 end), 0)`,
    })
    .from(transactions)
    .where(txScope);

  const totalSpend = Number.parseFloat(spendRow?.totalSpend ?? "0");
  const uncategorizedSpend = Number.parseFloat(spendRow?.uncategorizedSpend ?? "0");
  const categorizationRatio =
    totalSpend > 0 ? 1 - uncategorizedSpend / totalSpend : 1;

  const syncRows = await db
    .select({ lastSyncedAt: accounts.lastSyncedAt })
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, ctx.userIds),
        eq(accounts.isActive, true),
      ),
    );
  const plaidSync = await db
    .select({ lastSyncedAt: plaidItems.lastSyncedAt })
    .from(plaidItems)
    .where(inArray(plaidItems.userId, ctx.userIds));
  const tellerSync = await db
    .select({ lastSyncedAt: tellerEnrollments.lastSyncedAt })
    .from(tellerEnrollments)
    .where(inArray(tellerEnrollments.userId, ctx.userIds));

  const syncDates = [
    ...syncRows.map((r) => r.lastSyncedAt),
    ...plaidSync.map((r) => r.lastSyncedAt),
    ...tellerSync.map((r) => r.lastSyncedAt),
  ].filter((d): d is Date => d != null);

  const daysSinceSync =
    syncDates.length > 0
      ? Math.min(...syncDates.map((d) => daysBetween(d, new Date())))
      : 999;
  const syncFreshnessRatio =
    daysSinceSync <= 1 ? 1 : daysSinceSync <= 3 ? 0.85 : daysSinceSync <= 7 ? 0.6 : 0.3;

  const transferOut = Number.parseInt(spendRow?.transferOutCount ?? "0", 10);
  const transferPairRatio = await transferPairCoverage(ctx.userIds);
  const unpaired = await unpairedTransferLikeOutflows(ctx.userIds);
  const transferCaveats: string[] = [];
  if (transferOut === 0) {
    transferCaveats.push("No transfer outflows detected");
  } else if (transferPairRatio < 0.5) {
    transferCaveats.push(
      `Low transfer-pair coverage (${Math.round(transferPairRatio * 100)}% of transfer outflows linked)`,
    );
  }
  if (unpaired.count > 0) {
    transferCaveats.push(
      `${unpaired.count} unpaired transfer-like outflows (${formatMoneyAmount(unpaired.amount)} total) may still affect spend/income`,
    );
  }

  const signedSumRows = await db
    .select({
      accountId: transactions.accountId,
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      signedTotal: sql<string>`coalesce(sum(${transactions.signedAmount}::numeric), 0)`,
    })
    .from(transactions)
    .where(and(txScope, eq(transactions.pending, false)))
    .groupBy(transactions.accountId, sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM') desc`)
    .limit(24);

  let reconciliationGapRatio = 1;
  const reconciliationCaveats: string[] = [];
  if (signedSumRows.length >= 2) {
    reconciliationGapRatio = 0.75;
    reconciliationCaveats.push(
      "Reconciliation gap is approximate until balance snapshots cover all accounts",
    );
  }

  const pendingCount = Number.parseInt(spendRow?.pendingCount ?? "0", 10);
  const totalCount = Number.parseInt(spendRow?.totalCount ?? "0", 10);
  const pendingRatioValue = totalCount > 0 ? pendingCount / totalCount : 0;
  const pendingQuality = 1 - Math.min(pendingRatioValue, 0.25) / 0.25;

  const holdingRows = await db
    .select({
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
    })
    .from(holdings)
    .where(inArray(holdings.userId, ctx.userIds));

  let completeLots = 0;
  for (const row of holdingRows) {
    const qty = Number.parseFloat(row.quantity);
    const cost = Number.parseFloat(row.costBasis ?? "0");
    if (qty > 0 && cost > 0) completeLots += 1;
  }
  const costBasisRatio =
    holdingRows.length > 0 ? completeLots / holdingRows.length : 1;

  const signals = {
    categorization: confidenceFromCoverage(categorizationRatio),
    syncFreshness: syncFreshnessRatio,
    transferPairs: transferPairRatio,
    reconciliation: reconciliationGapRatio,
    pending: pendingQuality,
    costBasis: confidenceFromCoverage(costBasisRatio),
  };

  const compositeConfidence = compositeDataQualityConfidence(signals);
  const crossProviderDuplicates = await getCrossProviderDuplicateReport(userId);

  const crossProviderCaveats: string[] = [];
  if (crossProviderDuplicates.duplicateAccountPairs.length > 0) {
    crossProviderCaveats.push(
      `${crossProviderDuplicates.duplicateAccountPairs.length} likely duplicate account pair(s) across providers`,
    );
  }
  if (crossProviderDuplicates.duplicateTransactionCount > 0) {
    crossProviderCaveats.push(
      `${crossProviderDuplicates.duplicateTransactionCount} cross-account duplicate transaction(s) flagged`,
    );
  }

  return {
    categorizationCoverage: buildMetricEnvelope({
      value: categorizationRatio,
      unit: "ratio",
      asOf,
      class: "descriptive",
      basis: "factual",
      confidence: signals.categorization,
      caveats:
        uncategorizedSpend > 0
          ? [`${formatMoneyAmount(uncategorizedSpend)} uncategorized spend`]
          : undefined,
    }),
    syncFreshness: buildMetricEnvelope({
      value: daysSinceSync,
      unit: "months",
      asOf,
      class: "descriptive",
      basis: "factual",
      confidence: signals.syncFreshness,
      caveats:
        syncDates.length === 0 ? ["No sync timestamps recorded"] : undefined,
    }),
    transferPairCoverage: buildMetricEnvelope({
      value: transferPairRatio,
      unit: "ratio",
      asOf,
      class: "descriptive",
      basis: "heuristic",
      confidence: confidenceFromCoverage(transferPairRatio),
      caveats: transferCaveats.length > 0 ? transferCaveats : undefined,
    }),
    reconciliationGap: buildMetricEnvelope({
      value: 1 - reconciliationGapRatio,
      unit: "ratio",
      asOf,
      class: "diagnostic",
      basis: "heuristic",
      confidence: signals.reconciliation,
      caveats:
        reconciliationCaveats.length > 0 || crossProviderCaveats.length > 0
          ? [...reconciliationCaveats, ...crossProviderCaveats]
          : undefined,
    }),
    pendingRatio: buildMetricEnvelope({
      value: pendingRatioValue,
      unit: "ratio",
      asOf,
      class: "descriptive",
      basis: "factual",
      confidence: signals.pending,
    }),
    costBasisCompleteness: buildMetricEnvelope({
      value: costBasisRatio,
      unit: "ratio",
      asOf,
      class: "descriptive",
      basis: "factual",
      confidence: signals.costBasis,
      caveats:
        holdingRows.length === 0
          ? ["No investment holdings"]
          : completeLots < holdingRows.length
            ? [`${holdingRows.length - completeLots} holdings missing cost basis`]
            : undefined,
    }),
    compositeConfidence,
    isLive: totalCount > 0,
    crossProviderDuplicates,
  };
}

/** Fetch composite confidence for metric envelope scaling. */
export async function getCompositeDataQualityConfidence(
  userId: string,
): Promise<number> {
  const report = await getDataQuality(userId);
  return report.compositeConfidence;
}
