import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accountDuplicateDismissals,
  accounts,
  transactions,
} from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import { bankingDedupFingerprint } from "./import/fingerprint.js";

export interface DuplicateAccountPair {
  accountAId: string;
  accountBId: string;
  accountAName: string;
  accountBName: string;
  institutionName: string;
  mask: string;
  type: string;
  sourceA: string;
  sourceB: string;
  matchScore: number;
  reason: string;
}

export interface CrossAccountDuplicateTransaction {
  transactionAId: string;
  transactionBId: string;
  date: string;
  amount: string;
  name: string;
  accountAId: string;
  accountBId: string;
}

export interface CrossProviderDuplicateReport {
  duplicateAccountPairs: DuplicateAccountPair[];
  duplicateTransactionCount: number;
  duplicateTransactionsSample: CrossAccountDuplicateTransaction[];
  mergePath: string;
  dismissPath: string;
}

function normalizeInstitution(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function detectDuplicateAccountPairsFromRows(
  rows: Array<{
    id: string;
    name: string;
    mask: string;
    type: string;
    institutionName: string;
    source: string;
  }>,
): DuplicateAccountPair[] {
  const pairs: DuplicateAccountPair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i]!;
      const b = rows[j]!;
      if (a.id === b.id) continue;
      if (a.type !== b.type) continue;
      if (a.source === b.source) continue;

      const key = pairKey(a.id, b.id);
      if (seen.has(key)) continue;

      let score = 0;
      const reasons: string[] = [];

      if (a.mask === b.mask && a.mask.length >= 4) {
        score += 50;
        reasons.push("same last-4");
      }

      const instA = normalizeInstitution(a.institutionName);
      const instB = normalizeInstitution(b.institutionName);
      if (instA === instB) {
        score += 40;
        reasons.push("same institution");
      } else if (instA.includes(instB) || instB.includes(instA)) {
        score += 20;
        reasons.push("similar institution");
      }

      if (score >= 50) {
        seen.add(key);
        const [first, second] = a.id < b.id ? [a, b] : [b, a];
        pairs.push({
          accountAId: first.id,
          accountBId: second.id,
          accountAName: first.name,
          accountBName: second.name,
          institutionName: first.institutionName,
          mask: first.mask,
          type: first.type,
          sourceA: first.source,
          sourceB: second.source,
          matchScore: score,
          reason: reasons.join(", "),
        });
      }
    }
  }

  return pairs.sort((x, y) => y.matchScore - x.matchScore);
}

export async function detectDuplicateAccountPairs(
  userIds: string[],
  dismissedKeys: Set<string>,
): Promise<DuplicateAccountPair[]> {
  if (userIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      mask: accounts.mask,
      type: accounts.type,
      institutionName: accounts.institutionName,
      source: accounts.source,
    })
    .from(accounts)
    .where(
      and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)),
    );

  return detectDuplicateAccountPairsFromRows(rows).filter(
    (p) => !dismissedKeys.has(pairKey(p.accountAId, p.accountBId)),
  );
}

export async function detectCrossAccountDuplicateTransactions(
  userIds: string[],
  pairs: DuplicateAccountPair[],
  limit = 50,
): Promise<CrossAccountDuplicateTransaction[]> {
  if (pairs.length === 0 || userIds.length === 0) return [];
  const db = getDb();
  const accountIds = [...new Set(pairs.flatMap((p) => [p.accountAId, p.accountBId]))];

  const { accountIds: scopedIds } = await resolveActiveAccountScope(userIds);
  const scopedAccountIds = accountIds.filter((id) => scopedIds.includes(id));
  if (scopedAccountIds.length === 0) return [];

  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      name: transactions.name,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, scopedAccountIds),
        eq(transactions.pending, false),
      ),
    );

  const byAccount = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byAccount.get(row.accountId) ?? [];
    list.push(row);
    byAccount.set(row.accountId, list);
  }

  const duplicates: CrossAccountDuplicateTransaction[] = [];
  const seenTxnPairs = new Set<string>();

  for (const pair of pairs) {
    const listA = byAccount.get(pair.accountAId) ?? [];
    const indexB = new Map<string, (typeof rows)[number]>();
    for (const t of byAccount.get(pair.accountBId) ?? []) {
      indexB.set(`${t.date}|${t.amount}|${normalizeName(t.name)}`, t);
    }
    for (const a of listA) {
      const key = `${a.date}|${a.amount}|${normalizeName(a.name)}`;
      const b = indexB.get(key);
      if (!b) continue;
      const txnPairKey = pairKey(a.id, b.id);
      if (seenTxnPairs.has(txnPairKey)) continue;
      seenTxnPairs.add(txnPairKey);
      duplicates.push({
        transactionAId: a.id,
        transactionBId: b.id,
        date: a.date,
        amount: a.amount,
        name: a.name,
        accountAId: pair.accountAId,
        accountBId: pair.accountBId,
      });
      if (duplicates.length >= limit) return duplicates;
    }
  }

  return duplicates;
}

async function loadDismissedPairKeys(userId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({
      accountAId: accountDuplicateDismissals.accountAId,
      accountBId: accountDuplicateDismissals.accountBId,
    })
    .from(accountDuplicateDismissals)
    .where(eq(accountDuplicateDismissals.userId, userId));
  return new Set(rows.map((r) => pairKey(r.accountAId, r.accountBId)));
}

export async function getCrossProviderDuplicateReport(
  userId: string,
): Promise<CrossProviderDuplicateReport> {
  const ctx = await resolveHouseholdContext(userId);
  const dismissed = await loadDismissedPairKeys(userId);
  const pairs = await detectDuplicateAccountPairs(ctx.userIds, dismissed);
  const dupTxns = await detectCrossAccountDuplicateTransactions(
    ctx.userIds,
    pairs,
    25,
  );

  return {
    duplicateAccountPairs: pairs,
    duplicateTransactionCount: dupTxns.length,
    duplicateTransactionsSample: dupTxns,
    mergePath: "POST /api/v1/accounts/merge-provider-duplicates",
    dismissPath: "POST /api/v1/accounts/duplicate-pairs/dismiss",
  };
}

export async function dismissDuplicateAccountPair(
  userId: string,
  accountAId: string,
  accountBId: string,
): Promise<void> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds } = await resolveActiveAccountScope(ctx.userIds);
  if (!accountIds.includes(accountAId) || !accountIds.includes(accountBId)) {
    throw new Error("Accounts not found in household scope");
  }
  const [a, b] = accountAId < accountBId ? [accountAId, accountBId] : [accountBId, accountAId];
  const db = getDb();
  await db
    .insert(accountDuplicateDismissals)
    .values({ userId, accountAId: a, accountBId: b })
    .onConflictDoNothing();
}

export async function mergeProviderDuplicateAccounts(
  userId: string,
  keepAccountId: string,
  mergeAccountId: string,
): Promise<{ mergedAccountId: string; transactionsMoved: number }> {
  if (keepAccountId === mergeAccountId) {
    throw new Error("Cannot merge an account into itself");
  }
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const [keepRow] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, keepAccountId),
        inArray(accounts.userId, ctx.userIds),
        eq(accounts.isActive, true),
      ),
    )
    .limit(1);

  const [mergeRow] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, mergeAccountId),
        inArray(accounts.userId, ctx.userIds),
        eq(accounts.isActive, true),
      ),
    )
    .limit(1);

  if (!keepRow || !mergeRow) {
    throw new Error("One or both accounts not found");
  }
  if (keepRow.type !== mergeRow.type) {
    throw new Error("Cannot merge accounts of different types");
  }
  if (keepRow.source === mergeRow.source) {
    throw new Error("Merge is for cross-provider duplicates only");
  }

  const txRows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      name: transactions.name,
      externalId: transactions.externalId,
    })
    .from(transactions)
    .where(eq(transactions.accountId, mergeAccountId));

  let moved = 0;
  for (const tx of txRows) {
    const fingerprint = bankingDedupFingerprint(
      keepAccountId,
      tx.date,
      tx.amount,
      tx.name,
    );
    const externalId = `merged-${mergeAccountId.slice(0, 8)}-${tx.externalId}`.slice(
      0,
      120,
    );
    await db
      .update(transactions)
      .set({
        accountId: keepAccountId,
        externalId,
        dedupFingerprint: fingerprint,
      })
      .where(eq(transactions.id, tx.id));
    moved += 1;
  }

  await db
    .update(accounts)
    .set({
      isActive: false,
      status: "merged",
      officialName: `${mergeRow.name} (merged into ${keepRow.name})`,
    })
    .where(eq(accounts.id, mergeAccountId));

  return { mergedAccountId: mergeAccountId, transactionsMoved: moved };
}
