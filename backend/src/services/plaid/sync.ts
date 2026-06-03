import { CountryCode, type Transaction as PlaidTransaction } from "plaid";
import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { accounts, plaidItems, users } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import {
  createOperationTimer,
  logOperation,
  logOperationError,
  logOperationWarn,
} from "../../lib/operation-log.js";
import { createLogger } from "../../lib/logger.js";
import { getPlaidClient } from "./client.js";
import { decryptPlaidToken } from "./crypto.js";
import {
  applyMerchantCategoryRule,
  getMerchantCategoryRulesMap,
} from "../category-rules.js";
import { ensureAccountsAssignedToOwner } from "../household-store.js";
import { mapPlaidTransaction } from "./map-transaction.js";
import {
  deletePlaidTransactionsByExternalIds,
  PLAID_TXN_BATCH_SIZE,
  upsertPlaidTransactionBatch,
  type PlaidTransactionInsert,
} from "./upsert-transactions.js";

const log = createLogger("plaid.sync");

export interface SyncResult {
  itemId: string;
  institutionName: string;
  accountsSynced: number;
  added: number;
  modified: number;
  removed: number;
}

export interface PlaidSyncOptions {
  operationId?: string;
  trigger?: string;
  requestId?: string;
}

async function resolveInstitutionName(
  accessToken: string,
  env: Env,
): Promise<{ institutionId: string | null; institutionName: string }> {
  const client = getPlaidClient(env);
  try {
    const itemResponse = await client.itemGet({ access_token: accessToken });
    const institutionId = itemResponse.data.item.institution_id ?? null;
    if (!institutionId) {
      return { institutionId: null, institutionName: "Connected institution" };
    }
    const instResponse = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });
    return {
      institutionId,
      institutionName: instResponse.data.institution.name,
    };
  } catch {
    return { institutionId: null, institutionName: "Connected institution" };
  }
}

function mapTxnToRow(
  userId: string,
  accountId: string,
  txn: PlaidTransaction,
  accountType: "depository" | "credit",
  categoryRules: Map<string, string>,
): PlaidTransactionInsert {
  const mapped = mapPlaidTransaction(txn, accountType);
  const category = applyMerchantCategoryRule(
    categoryRules,
    mapped.merchantName,
    mapped.name,
    mapped.category,
  );

  return {
    userId,
    accountId,
    externalId: mapped.externalId,
    date: mapped.date,
    name: mapped.name,
    merchantName: mapped.merchantName,
    amount: mapped.amount,
    category,
    transactionType: mapped.transactionType,
    isTransfer: mapped.isTransfer,
    pending: mapped.pending,
    source: "plaid",
  };
}

async function flushTransactionBatch(
  db: ReturnType<typeof getDb>,
  batch: PlaidTransactionInsert[],
): Promise<void> {
  for (let i = 0; i < batch.length; i += PLAID_TXN_BATCH_SIZE) {
    await upsertPlaidTransactionBatch(
      db,
      batch.slice(i, i + PLAID_TXN_BATCH_SIZE),
    );
  }
}

export async function syncPlaidItem(
  itemDbId: string,
  env: Env,
  options: PlaidSyncOptions = {},
): Promise<SyncResult> {
  const operationId = options.operationId ?? crypto.randomUUID();
  const trigger = options.trigger ?? "manual";
  const elapsed = createOperationTimer();
  const db = getDb();

  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.id, itemDbId))
    .limit(1);

  if (!item) {
    logOperationWarn(
      log,
      "failed",
      "Plaid item not found — sync aborted",
      { operation: "plaid.sync_item", operationId, itemDbId, trigger },
    );
    throw AppError.notFound("Plaid item not found");
  }

  const [userRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, item.userId))
    .limit(1);

  const baseContext = {
    operation: "plaid.sync_item" as const,
    operationId,
    trigger,
    requestId: options.requestId,
    userId: item.userId,
    userEmail: userRow?.email ?? null,
    itemDbId,
    plaidItemId: item.plaidItemId,
    hadCursor: Boolean(item.cursor),
  };

  logOperation(log, "started", "Plaid item sync started", {
    ...baseContext,
    lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
    institutionName: item.institutionName,
  });

  let accessToken: string;
  try {
    accessToken = decryptPlaidToken(item.accessTokenEncrypted, env);
    logOperation(log, "token_decrypted", "Plaid access token decrypted", baseContext);
  } catch (error) {
    logOperationError(
      log,
      "failed",
      "Failed to decrypt Plaid access token — sync aborted",
      baseContext,
      error,
    );
    throw AppError.plaidSyncError(
      "Could not decrypt stored Plaid credentials. Re-link the account or check ENCRYPTION_KEY.",
      error,
    );
  }

  const client = getPlaidClient(env);
  const { institutionId, institutionName } =
    await resolveInstitutionName(accessToken, env);

  logOperation(log, "institution_resolved", "Plaid institution resolved", {
    ...baseContext,
    institutionName,
    institutionId,
  });

  await db
    .update(plaidItems)
    .set({
      institutionId,
      institutionName,
      status: "active",
    })
    .where(eq(plaidItems.id, itemDbId));

  const accountsResponse = await client.accountsGet({
    access_token: accessToken,
  });

  const accountIdByPlaidId = new Map<string, string>();
  const accountSummaries: {
    accountId: string;
    plaidAccountId: string;
    name: string;
    mask: string;
    type: string;
  }[] = [];

  for (const plaidAccount of accountsResponse.data.accounts) {
    const mask = plaidAccount.mask ?? "0000";
    const balanceCurrent =
      plaidAccount.balances.current?.toFixed(2) ?? "0.00";
    const balanceAvailable =
      plaidAccount.balances.available?.toFixed(2) ?? null;

    const existing = await db
      .select()
      .from(accounts)
      .where(eq(accounts.plaidAccountId, plaidAccount.account_id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(accounts)
        .set({
          name: plaidAccount.name,
          officialName: plaidAccount.official_name,
          type: plaidAccount.type,
          subtype: plaidAccount.subtype,
          mask,
          institutionName,
          balanceCurrent,
          balanceAvailable,
          lastSyncedAt: new Date(),
          status: "active",
          isActive: true,
        })
        .where(eq(accounts.id, existing[0].id));
      accountIdByPlaidId.set(plaidAccount.account_id, existing[0].id);
      accountSummaries.push({
        accountId: existing[0].id,
        plaidAccountId: plaidAccount.account_id,
        name: plaidAccount.name,
        mask,
        type: plaidAccount.type,
      });
      continue;
    }

    const [inserted] = await db
      .insert(accounts)
      .values({
        userId: item.userId,
        plaidItemId: itemDbId,
        plaidAccountId: plaidAccount.account_id,
        name: plaidAccount.name,
        officialName: plaidAccount.official_name,
        type: plaidAccount.type,
        subtype: plaidAccount.subtype,
        mask,
        institutionName,
        currencyCode: plaidAccount.balances.iso_currency_code ?? "USD",
        source: "plaid",
        balanceCurrent,
        balanceAvailable,
        lastSyncedAt: new Date(),
        status: "active",
      })
      .returning();

    accountIdByPlaidId.set(plaidAccount.account_id, inserted!.id);
    accountSummaries.push({
      accountId: inserted!.id,
      plaidAccountId: plaidAccount.account_id,
      name: plaidAccount.name,
      mask,
      type: plaidAccount.type,
    });
  }

  logOperation(log, "accounts_synced", "Plaid accounts loaded and balances updated", {
    ...baseContext,
    institutionName,
    accountsSynced: accountSummaries.length,
    accounts: accountSummaries,
  });

  await ensureAccountsAssignedToOwner(
    item.userId,
    [...accountIdByPlaidId.values()],
  );

  const categoryRules = await getMerchantCategoryRulesMap(item.userId);

  const accountTypeByPlaidId = new Map(
    accountsResponse.data.accounts.map((account) => [
      account.account_id,
      account.type as "depository" | "credit",
    ]),
  );

  let cursor = item.cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    page += 1;
    logOperation(log, "transactions_page", "Fetching transaction page from Plaid", {
      ...baseContext,
      institutionName,
      page,
      cursorPresent: Boolean(cursor),
    });

    const syncResponse = await client.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    const upsertBatch: PlaidTransactionInsert[] = [];

    for (const txn of syncResponse.data.added) {
      const accountId = accountIdByPlaidId.get(txn.account_id);
      if (!accountId) continue;

      upsertBatch.push(
        mapTxnToRow(
          item.userId,
          accountId,
          txn,
          accountTypeByPlaidId.get(txn.account_id) ?? "depository",
          categoryRules,
        ),
      );
    }
    await flushTransactionBatch(db, upsertBatch);
    added += upsertBatch.length;

    const modifiedBatch: PlaidTransactionInsert[] = [];
    for (const txn of syncResponse.data.modified) {
      const accountId = accountIdByPlaidId.get(txn.account_id);
      if (!accountId) continue;

      modifiedBatch.push(
        mapTxnToRow(
          item.userId,
          accountId,
          txn,
          accountTypeByPlaidId.get(txn.account_id) ?? "depository",
          categoryRules,
        ),
      );
    }
    await flushTransactionBatch(db, modifiedBatch);
    modified += modifiedBatch.length;

    const removedExternalIds = syncResponse.data.removed.map(
      (removedTxn) => `plaid-${removedTxn.transaction_id}`,
    );
    removed += await deletePlaidTransactionsByExternalIds(
      db,
      removedExternalIds,
    );

    cursor = syncResponse.data.next_cursor;
    hasMore = syncResponse.data.has_more;

    logOperation(log, "transactions_page", "Transaction page applied to database", {
      ...baseContext,
      institutionName,
      page,
      pageAdded: upsertBatch.length,
      pageModified: modifiedBatch.length,
      pageRemoved: removedExternalIds.length,
      totalAdded: added,
      totalModified: modified,
      totalRemoved: removed,
      hasMore,
    });
  }

  await db
    .update(plaidItems)
    .set({
      cursor,
      lastSyncedAt: new Date(),
      institutionName,
      status: "active",
    })
    .where(eq(plaidItems.id, itemDbId));

  const result: SyncResult = {
    itemId: item.plaidItemId,
    institutionName,
    accountsSynced: accountIdByPlaidId.size,
    added,
    modified,
    removed,
  };

  logOperation(log, "completed", "Plaid item sync completed successfully", {
    ...baseContext,
    institutionName,
    accountsSynced: result.accountsSynced,
    added: result.added,
    modified: result.modified,
    removed: result.removed,
    transactionPages: page,
    durationMs: elapsed(),
  });

  return result;
}
