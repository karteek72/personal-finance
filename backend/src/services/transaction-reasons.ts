import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { transactionReasons, transactions } from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import { resolveActiveAccountScope } from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";

export const TRANSACTION_REASON_IDS = [
  "need",
  "treat",
  "social",
  "bored",
  "stress",
  "impulse",
] as const;

export type TransactionReasonId = (typeof TRANSACTION_REASON_IDS)[number];

function isValidReasonId(reasonId: string): reasonId is TransactionReasonId {
  return (TRANSACTION_REASON_IDS as readonly string[]).includes(reasonId);
}

async function assertTransactionAccess(
  userId: string,
  transactionId: string,
): Promise<void> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds } = await resolveActiveAccountScope(ctx.userIds);
  const db = getDb();

  const [txn] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        inArray(transactions.userId, ctx.userIds),
        inArray(transactions.accountId, accountIds),
      ),
    )
    .limit(1);

  if (!txn) {
    throw AppError.notFound("Transaction not found");
  }
}

export async function setTransactionReason(
  userId: string,
  transactionId: string,
  reasonId: string,
): Promise<{ transactionId: string; reasonId: TransactionReasonId }> {
  if (!isValidReasonId(reasonId)) {
    throw AppError.validation(
      `Invalid reason id; expected one of: ${TRANSACTION_REASON_IDS.join(", ")}`,
    );
  }

  await assertTransactionAccess(userId, transactionId);

  const db = getDb();
  await db
    .insert(transactionReasons)
    .values({ transactionId, userId, reasonId })
    .onConflictDoUpdate({
      target: transactionReasons.transactionId,
      set: { reasonId, userId },
    });

  return { transactionId, reasonId };
}

export async function clearTransactionReason(
  userId: string,
  transactionId: string,
): Promise<{ transactionId: string; cleared: true }> {
  await assertTransactionAccess(userId, transactionId);

  const db = getDb();
  await db
    .delete(transactionReasons)
    .where(
      and(
        eq(transactionReasons.transactionId, transactionId),
        eq(transactionReasons.userId, userId),
      ),
    );

  return { transactionId, cleared: true };
}
