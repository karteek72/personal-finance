import type { APR, CreditCardLiability } from "plaid";
import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { creditCardLiabilities } from "../../db/schema.js";
import { formatMoneyAmount } from "../../lib/money.js";
import { createLogger } from "../../lib/logger.js";
import { getPlaidClient, hasLiabilitiesProduct } from "./client.js";

const log = createLogger("plaid.sync-liabilities");

export interface StoredApr {
  aprType: string;
  aprPercentage: string;
  balanceSubjectToApr: string | null;
  interestChargeAmount: string | null;
}

function mapAprs(aprs: APR[]): StoredApr[] {
  return aprs.map((apr) => ({
    aprType: apr.apr_type,
    aprPercentage: apr.apr_percentage.toFixed(2),
    balanceSubjectToApr:
      apr.balance_subject_to_apr != null
        ? apr.balance_subject_to_apr.toFixed(2)
        : null,
    interestChargeAmount:
      apr.interest_charge_amount != null
        ? apr.interest_charge_amount.toFixed(2)
        : null,
  }));
}

function toMoney(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return formatMoneyAmount(value);
}

async function upsertCreditCardLiability(
  accountId: string,
  liability: CreditCardLiability,
): Promise<void> {
  const db = getDb();
  await db
    .insert(creditCardLiabilities)
    .values({
      accountId,
      lastStatementBalance: toMoney(liability.last_statement_balance),
      lastStatementIssueDate: liability.last_statement_issue_date,
      minimumPaymentAmount: toMoney(liability.minimum_payment_amount),
      nextPaymentDueDate: liability.next_payment_due_date,
      lastPaymentAmount: toMoney(liability.last_payment_amount),
      lastPaymentDate: liability.last_payment_date,
      isOverdue: liability.is_overdue,
      aprs: mapAprs(liability.aprs ?? []),
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: creditCardLiabilities.accountId,
      set: {
        lastStatementBalance: toMoney(liability.last_statement_balance),
        lastStatementIssueDate: liability.last_statement_issue_date,
        minimumPaymentAmount: toMoney(liability.minimum_payment_amount),
        nextPaymentDueDate: liability.next_payment_due_date,
        lastPaymentAmount: toMoney(liability.last_payment_amount),
        lastPaymentDate: liability.last_payment_date,
        isOverdue: liability.is_overdue,
        aprs: mapAprs(liability.aprs ?? []),
        syncedAt: new Date(),
      },
    });
}

export interface SyncLiabilitiesResult {
  creditCardsUpdated: number;
  skipped: boolean;
}

export async function syncCreditCardLiabilities(
  accessToken: string,
  accountIdByPlaidId: Map<string, string>,
  env: Env,
): Promise<SyncLiabilitiesResult> {
  if (!hasLiabilitiesProduct(env)) {
    return { creditCardsUpdated: 0, skipped: true };
  }

  const client = getPlaidClient(env);
  let creditCards: CreditCardLiability[] = [];

  try {
    const response = await client.liabilitiesGet({ access_token: accessToken });
    creditCards = response.data.liabilities.credit ?? [];
  } catch (error) {
    log.warn(
      { err: error },
      "Plaid liabilitiesGet failed — skipping liability sync for item",
    );
    return { creditCardsUpdated: 0, skipped: true };
  }

  let creditCardsUpdated = 0;
  for (const liability of creditCards) {
    if (!liability.account_id) {
      continue;
    }
    const accountId = accountIdByPlaidId.get(liability.account_id);
    if (!accountId) {
      continue;
    }
    await upsertCreditCardLiability(accountId, liability);
    creditCardsUpdated += 1;
  }

  return { creditCardsUpdated, skipped: false };
}

export async function deleteCreditCardLiability(accountId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(creditCardLiabilities)
    .where(eq(creditCardLiabilities.accountId, accountId));
}
