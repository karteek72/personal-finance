import { CountryCode } from "plaid";
import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { accounts, plaidItems, transactions } from "../../db/schema.js";
import { getPlaidClient } from "./client.js";
import { decryptPlaidToken } from "./crypto.js";
import { mapPlaidTransaction } from "./map-transaction.js";

export interface SyncResult {
  itemId: string;
  institutionName: string;
  accountsSynced: number;
  added: number;
  modified: number;
  removed: number;
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

export async function syncPlaidItem(
  itemDbId: string,
  env: Env,
): Promise<SyncResult> {
  const db = getDb();
  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.id, itemDbId))
    .limit(1);

  if (!item) {
    throw new Error("Plaid item not found");
  }

  const accessToken = decryptPlaidToken(item.accessTokenEncrypted, env);
  const client = getPlaidClient(env);
  const { institutionId, institutionName } =
    await resolveInstitutionName(accessToken, env);

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
  }

  let cursor = item.cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  while (hasMore) {
    const syncResponse = await client.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    const accountTypeByPlaidId = new Map(
      accountsResponse.data.accounts.map((account) => [
        account.account_id,
        account.type as "depository" | "credit",
      ]),
    );

    for (const txn of syncResponse.data.added) {
      const accountId = accountIdByPlaidId.get(txn.account_id);
      if (!accountId) continue;

      const mapped = mapPlaidTransaction(
        txn,
        accountTypeByPlaidId.get(txn.account_id) ?? "depository",
      );

      await db
        .insert(transactions)
        .values({
          userId: item.userId,
          accountId,
          externalId: mapped.externalId,
          date: mapped.date,
          name: mapped.name,
          merchantName: mapped.merchantName,
          amount: mapped.amount,
          category: mapped.category,
          transactionType: mapped.transactionType,
          isTransfer: mapped.isTransfer,
          pending: mapped.pending,
          source: "plaid",
        })
        .onConflictDoUpdate({
          target: [transactions.accountId, transactions.externalId],
          set: {
            date: mapped.date,
            name: mapped.name,
            merchantName: mapped.merchantName,
            amount: mapped.amount,
            category: mapped.category,
            transactionType: mapped.transactionType,
            isTransfer: mapped.isTransfer,
            pending: mapped.pending,
            source: "plaid",
          },
        });
      added++;
    }

    for (const txn of syncResponse.data.modified) {
      const accountId = accountIdByPlaidId.get(txn.account_id);
      if (!accountId) continue;

      const mapped = mapPlaidTransaction(
        txn,
        accountTypeByPlaidId.get(txn.account_id) ?? "depository",
      );

      await db
        .insert(transactions)
        .values({
          userId: item.userId,
          accountId,
          externalId: mapped.externalId,
          date: mapped.date,
          name: mapped.name,
          merchantName: mapped.merchantName,
          amount: mapped.amount,
          category: mapped.category,
          transactionType: mapped.transactionType,
          isTransfer: mapped.isTransfer,
          pending: mapped.pending,
          source: "plaid",
        })
        .onConflictDoUpdate({
          target: [transactions.accountId, transactions.externalId],
          set: {
            date: mapped.date,
            name: mapped.name,
            merchantName: mapped.merchantName,
            amount: mapped.amount,
            category: mapped.category,
            transactionType: mapped.transactionType,
            isTransfer: mapped.isTransfer,
            pending: mapped.pending,
            source: "plaid",
          },
        });
      modified++;
    }

    for (const removedTxn of syncResponse.data.removed) {
      await db
        .delete(transactions)
        .where(eq(transactions.externalId, `plaid-${removedTxn.transaction_id}`));
      removed++;
    }

    cursor = syncResponse.data.next_cursor;
    hasMore = syncResponse.data.has_more;
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

  return {
    itemId: item.plaidItemId,
    institutionName,
    accountsSynced: accountIdByPlaidId.size,
    added,
    modified,
    removed,
  };
}
