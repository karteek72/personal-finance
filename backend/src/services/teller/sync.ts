import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { accounts, tellerEnrollments } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import { formatMoneyAmount } from "../../lib/money.js";
import { createLogger } from "../../lib/logger.js";
import {
  getMerchantCategoryRulesMap,
  type CategoryRule,
} from "../category-rules.js";
import { classifyBankingTransaction } from "../classify-banking-transaction.js";
import { ensureAccountsAssignedToOwner } from "../household-store.js";
import { upsertBalanceSnapshotsForAccountIds } from "../balance-snapshots.js";
import { backfillTransactionMerchantIds } from "../dim-merchant-store.js";
import { recomputeAllAnalytics } from "../recompute-all-analytics.js";
import {
  PLAID_TXN_BATCH_SIZE,
  upsertPlaidTransactionBatch,
  type PlaidTransactionInsert,
} from "../plaid/upsert-transactions.js";
import {
  getTellerBalances,
  listTellerAccounts,
  listTellerTransactions,
} from "./client.js";
import { decryptTellerToken } from "./crypto.js";
import { mapTellerTransaction } from "./map-transaction.js";

const log = createLogger("teller.sync");

export interface TellerSyncResult {
  enrollmentId: string;
  institutionName: string;
  accountsSynced: number;
  transactionsAdded: number;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function mapTxnToRow(
  userId: string,
  accountId: string,
  mapped: ReturnType<typeof mapTellerTransaction>,
  accountType: "depository" | "credit",
  categoryRules: Map<string, CategoryRule>,
): PlaidTransactionInsert {
  const classified = classifyBankingTransaction({
    categoryHint: mapped.category,
    name: mapped.name,
    merchantName: mapped.merchantName,
    categoryRules,
    pfcDetailed: null,
    transactionType: mapped.transactionType,
    isTransfer: mapped.isTransfer,
  });

  return {
    userId,
    accountId,
    externalId: mapped.externalId,
    date: mapped.date,
    name: mapped.name,
    merchantName: mapped.merchantName,
    amount: mapped.amount,
    category: classified.category,
    subCategory: classified.subCategory,
    transactionType: classified.transactionType,
    isTransfer: classified.isTransfer,
    pending: mapped.pending,
    source: "teller",
  };
}

export async function syncTellerEnrollment(
  enrollmentDbId: string,
  env: Env,
): Promise<TellerSyncResult> {
  const db = getDb();
  const [enrollment] = await db
    .select()
    .from(tellerEnrollments)
    .where(eq(tellerEnrollments.id, enrollmentDbId))
    .limit(1);

  if (!enrollment) {
    throw AppError.notFound("Teller enrollment not found");
  }

  const accessToken = decryptTellerToken(
    enrollment.accessTokenEncrypted,
    env,
  );
  const tellerAccounts = await listTellerAccounts(accessToken, env);
  const institutionName =
    tellerAccounts[0]?.institution.name ??
    enrollment.institutionName ??
    "Connected institution";

  const accountIdByTellerId = new Map<string, string>();
  let accountsSynced = 0;

  for (const acct of tellerAccounts) {
    if (acct.status === "closed") continue;

    const mask = acct.last_four?.slice(-4) || "0000";
    let balanceCurrent = "0.00";
    let balanceAvailable: string | null = null;

    if (acct.links.balances) {
      try {
        const balances = await getTellerBalances(acct.id, accessToken, env);
        const ledger = balances.ledger ?? balances.available;
        const available = balances.available ?? balances.ledger;
        if (ledger) balanceCurrent = formatMoneyAmount(ledger);
        if (available) balanceAvailable = formatMoneyAmount(available);
      } catch (error) {
        log.warn({ err: error, accountId: acct.id }, "teller balance fetch failed");
      }
    }

    const [existing] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.tellerAccountId, acct.id))
      .limit(1);

    if (existing) {
      await db
        .update(accounts)
        .set({
          name: acct.name,
          type: acct.type,
          subtype: acct.subtype,
          mask,
          institutionName: acct.institution.name,
          balanceCurrent,
          balanceAvailable,
          lastSyncedAt: new Date(),
          status: "active",
        })
        .where(eq(accounts.id, existing.id));
      accountIdByTellerId.set(acct.id, existing.id);
    } else {
      const [inserted] = await db
        .insert(accounts)
        .values({
          userId: enrollment.userId,
          tellerEnrollmentId: enrollmentDbId,
          tellerAccountId: acct.id,
          name: acct.name,
          type: acct.type,
          subtype: acct.subtype,
          mask,
          institutionName: acct.institution.name,
          currencyCode: acct.currency ?? "USD",
          source: "teller",
          balanceCurrent,
          balanceAvailable,
          lastSyncedAt: new Date(),
          status: "active",
        })
        .returning();
      accountIdByTellerId.set(acct.id, inserted!.id);
    }
    accountsSynced += 1;
  }

  await db
    .update(tellerEnrollments)
    .set({ institutionName, lastSyncedAt: new Date() })
    .where(eq(tellerEnrollments.id, enrollmentDbId));

  await ensureAccountsAssignedToOwner(
    enrollment.userId,
    [...accountIdByTellerId.values()],
  );

  await upsertBalanceSnapshotsForAccountIds([...accountIdByTellerId.values()]);

  const categoryRules = await getMerchantCategoryRulesMap(enrollment.userId);
  const startDate = daysAgoIso(730);
  const endDate = daysAgoIso(0);
  let transactionsAdded = 0;
  const batch: PlaidTransactionInsert[] = [];

  for (const acct of tellerAccounts) {
    if (acct.status === "closed" || !acct.links.transactions) continue;
    const accountId = accountIdByTellerId.get(acct.id);
    if (!accountId) continue;

    const txns = await listTellerTransactions(acct.id, accessToken, env, {
      startDate,
      endDate,
    });

    for (const txn of txns) {
      const mapped = mapTellerTransaction(txn, acct.type);
      batch.push(
        mapTxnToRow(
          enrollment.userId,
          accountId,
          mapped,
          acct.type,
          categoryRules,
        ),
      );
    }
  }

  for (let i = 0; i < batch.length; i += PLAID_TXN_BATCH_SIZE) {
    await upsertPlaidTransactionBatch(
      db,
      batch.slice(i, i + PLAID_TXN_BATCH_SIZE),
    );
    transactionsAdded += Math.min(
      PLAID_TXN_BATCH_SIZE,
      batch.length - i,
    );
  }

  log.info(
    {
      enrollmentDbId,
      accountsSynced,
      transactionsAdded: batch.length,
    },
    "teller enrollment synced",
  );

  await backfillTransactionMerchantIds(enrollment.userId);
  await recomputeAllAnalytics(enrollment.userId);

  return {
    enrollmentId: enrollment.tellerEnrollmentId,
    institutionName,
    accountsSynced,
    transactionsAdded: batch.length,
  };
}
