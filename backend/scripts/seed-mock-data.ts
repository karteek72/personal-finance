/**
 * Load deterministic demo data from ../mock/ into PostgreSQL.
 *
 * Usage (from backend/):
 *   npm run db:seed
 *   npm run db:seed -- --no-reset   # append without clearing prior seed users
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { loadEnv } from "../src/config/env.js";
import { closeDb, getDb } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import {
  accounts,
  creditCardLiabilities,
  householdAccountAssignments,
  householdInvitations,
  householdMembers,
  households,
  merchantCategoryRules,
  plaidItems,
  transactions,
  users,
} from "../src/db/schema.js";
import { encryptPlaidToken } from "../src/services/plaid/crypto.js";

const MOCK_ROOT = resolve(process.cwd(), "../mock");
const SEED_SOURCE = "import";

interface Manifest {
  version: number;
  devUserEmail: string;
  partnerUserEmail: string;
  externalIdPrefix: string;
  files: Record<string, string>;
}

interface SeedUser {
  id: string;
  email: string;
  displayName: string | null;
  googleSub: string | null;
}

interface SeedAccount {
  id: string;
  name: string;
  officialName: string | null;
  type: "credit" | "depository";
  subtype: string | null;
  mask: string;
  balanceCurrent: string;
  balanceAvailable: string | null;
  currencyCode: string;
  institutionName: string;
  source: string;
  plaidAccountId: string | null;
  lastSyncedAt: string | null;
  status: string;
}

interface SeedTransaction {
  id: string;
  accountId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: string;
  category: string;
  subCategory?: string | null;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
}

interface MonthlySpendCategory {
  category: string;
  subCategory: string;
  amounts: string[];
  merchantName: string;
  accountId: string;
  transactionType?: "expense" | "income" | "transfer";
}

function readJson<T>(filename: string): T {
  const path = resolve(MOCK_ROOT, filename);
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function parseArgs(argv: string[]): { reset: boolean } {
  return { reset: !argv.includes("--no-reset") };
}

async function clearSeedUsers(emails: string[]): Promise<void> {
  const db = getDb();
  const seedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, emails));

  if (seedUsers.length === 0) {
    return;
  }

  const ids = seedUsers.map((row) => row.id);
  await db.delete(users).where(inArray(users.id, ids));
  console.log(`Cleared ${ids.length} existing seed user(s) and cascaded data.`);
}

function expandMonthlyTransactions(
  prefix: string,
  ownerUserId: string,
  data: {
    months: string[];
    categories: MonthlySpendCategory[];
  },
): Array<typeof transactions.$inferInsert> {
  const rows: Array<typeof transactions.$inferInsert> = [];
  let seq = 0;

  for (const categoryRow of data.categories) {
    const txnType = categoryRow.transactionType ?? "expense";
    const isTransfer = txnType === "transfer";

    for (let i = 0; i < data.months.length; i++) {
      const month = data.months[i]!;
      const amount = categoryRow.amounts[i]!;
      const day = txnType === "income" ? "01" : "15";
      seq += 1;

      rows.push({
        id: undefined,
        userId: ownerUserId,
        accountId: categoryRow.accountId,
        externalId: `${prefix}hist-${month}-${categoryRow.category}-${seq}`,
        date: `${month}-${day}`,
        name: categoryRow.merchantName,
        merchantName: categoryRow.merchantName,
        amount,
        currencyCode: "USD",
        category: categoryRow.category,
        subCategory: categoryRow.subCategory,
        transactionType: txnType,
        isTransfer,
        pending: false,
        source: SEED_SOURCE,
      });
    }
  }

  return rows;
}

async function main(): Promise<void> {
  const { reset } = parseArgs(process.argv.slice(2));
  const env = loadEnv();

  console.log("Running migrations...");
  await runMigrations(env.DATABASE_URL);

  const manifest = readJson<Manifest>("manifest.json");
  const seedEmails = [manifest.devUserEmail, manifest.partnerUserEmail];

  if (reset) {
    await clearSeedUsers(seedEmails);
  }

  const db = getDb();

  const usersFile = readJson<{ users: SeedUser[] }>(manifest.files.users);
  const emailToUserId = new Map<string, string>();

  for (const row of usersFile.users) {
    const [user] = await db
      .insert(users)
      .values({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        googleSub: row.googleSub,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          displayName: row.displayName,
          googleSub: row.googleSub,
        },
      })
      .returning();
    emailToUserId.set(row.email, user!.id);
    console.log(`User: ${row.email}`);
  }

  const ownerUserId = emailToUserId.get(manifest.devUserEmail);
  if (!ownerUserId) {
    throw new Error(`Missing dev user: ${manifest.devUserEmail}`);
  }

  const plaidFile = readJson<{
    items: Array<{
      id: string;
      plaidItemId: string;
      accessToken: string;
      institutionId: string | null;
      institutionName: string | null;
      accountIds: string[];
    }>;
  }>(manifest.files.plaidItems);

  const plaidItemIdByAccount = new Map<string, string>();

  for (const item of plaidFile.items) {
    const encrypted = encryptPlaidToken(item.accessToken, env);
    await db
      .insert(plaidItems)
      .values({
        id: item.id,
        userId: ownerUserId,
        plaidItemId: item.plaidItemId,
        accessTokenEncrypted: encrypted,
        institutionId: item.institutionId,
        institutionName: item.institutionName,
        status: "active",
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: plaidItems.plaidItemId,
        set: {
          accessTokenEncrypted: encrypted,
          institutionId: item.institutionId,
          institutionName: item.institutionName,
          lastSyncedAt: new Date(),
        },
      });

    for (const accountId of item.accountIds) {
      plaidItemIdByAccount.set(accountId, item.id);
    }
  }

  const accountsFile = readJson<{ accounts: SeedAccount[] }>(
    manifest.files.accounts,
  );

  for (const row of accountsFile.accounts) {
    await db
      .insert(accounts)
      .values({
        id: row.id,
        userId: ownerUserId,
        plaidItemId: plaidItemIdByAccount.get(row.id) ?? null,
        plaidAccountId: row.plaidAccountId,
        name: row.name,
        officialName: row.officialName,
        type: row.type,
        subtype: row.subtype,
        mask: row.mask,
        institutionName: row.institutionName,
        currencyCode: row.currencyCode,
        source: row.source,
        balanceCurrent: row.balanceCurrent,
        balanceAvailable: row.balanceAvailable,
        status: row.status,
        isActive: true,
        lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          balanceCurrent: row.balanceCurrent,
          balanceAvailable: row.balanceAvailable,
          lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
          plaidItemId: plaidItemIdByAccount.get(row.id) ?? null,
        },
      });
  }
  console.log(`Accounts: ${accountsFile.accounts.length}`);

  const prefix = manifest.externalIdPrefix;
  const mayFile = readJson<{ items: SeedTransaction[] }>(
    manifest.files.transactionsMay,
  );
  const monthlyFile = readJson<{
    months: string[];
    categories: MonthlySpendCategory[];
  }>(manifest.files.monthlySpend);

  const txnRows: Array<typeof transactions.$inferInsert> = [
    ...mayFile.items.map((txn) => ({
      id: txn.id,
      userId: ownerUserId,
      accountId: txn.accountId,
      externalId: `${prefix}${txn.id}`,
      date: txn.date,
      name: txn.name,
      merchantName: txn.merchantName,
      amount: txn.amount,
      currencyCode: "USD",
      category: txn.category,
      subCategory: txn.subCategory ?? null,
      transactionType: txn.transactionType,
      isTransfer: txn.isTransfer,
      pending: txn.pending,
      source: SEED_SOURCE,
    })),
    ...expandMonthlyTransactions(prefix, ownerUserId, monthlyFile),
  ];

  const BATCH = 50;
  for (let i = 0; i < txnRows.length; i += BATCH) {
    await db
      .insert(transactions)
      .values(txnRows.slice(i, i + BATCH))
      .onConflictDoUpdate({
        target: [transactions.accountId, transactions.externalId],
        set: {
          date: sql`excluded.date`,
          name: sql`excluded.name`,
          merchantName: sql`excluded.merchant_name`,
          amount: sql`excluded.amount`,
          category: sql`excluded.category`,
          subCategory: sql`excluded.sub_category`,
          transactionType: sql`excluded.transaction_type`,
          isTransfer: sql`excluded.is_transfer`,
          pending: sql`excluded.pending`,
        },
      });
  }
  console.log(`Transactions: ${txnRows.length}`);

  const rulesFile = readJson<{
    rules: Array<{
      merchantKey: string;
      category: string;
      subCategory: string | null;
    }>;
  }>(manifest.files.merchantCategoryRules);

  for (const rule of rulesFile.rules) {
    await db
      .insert(merchantCategoryRules)
      .values({
        userId: ownerUserId,
        merchantKey: rule.merchantKey,
        category: rule.category,
        subCategory: rule.subCategory,
      })
      .onConflictDoUpdate({
        target: [merchantCategoryRules.userId, merchantCategoryRules.merchantKey],
        set: {
          category: rule.category,
          subCategory: rule.subCategory,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`Merchant rules: ${rulesFile.rules.length}`);

  const liabilitiesFile = readJson<{
    liabilities: Array<{
      accountId: string;
      lastStatementBalance: string | null;
      lastStatementIssueDate: string | null;
      minimumPaymentAmount: string | null;
      nextPaymentDueDate: string | null;
      lastPaymentAmount: string | null;
      lastPaymentDate: string | null;
      isOverdue: boolean | null;
      aprs: unknown;
    }>;
  }>(manifest.files.creditCardLiabilities);

  for (const row of liabilitiesFile.liabilities) {
    await db
      .insert(creditCardLiabilities)
      .values({
        accountId: row.accountId,
        lastStatementBalance: row.lastStatementBalance,
        lastStatementIssueDate: row.lastStatementIssueDate,
        minimumPaymentAmount: row.minimumPaymentAmount,
        nextPaymentDueDate: row.nextPaymentDueDate,
        lastPaymentAmount: row.lastPaymentAmount,
        lastPaymentDate: row.lastPaymentDate,
        isOverdue: row.isOverdue,
        aprs: row.aprs,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: creditCardLiabilities.accountId,
        set: {
          lastStatementBalance: row.lastStatementBalance,
          nextPaymentDueDate: row.nextPaymentDueDate,
          isOverdue: row.isOverdue,
          syncedAt: new Date(),
        },
      });
  }
  console.log(`Credit liabilities: ${liabilitiesFile.liabilities.length}`);

  const householdFile = readJson<{
    household: { id: string; name: string };
    members: Array<{
      id: string;
      userEmail: string | null;
      displayName: string;
      role: string;
      avatarColor: string;
    }>;
    accountAssignments: Array<{ accountId: string; memberId: string }>;
    invitations: Array<{
      memberId: string;
      email: string;
      token: string;
      expiresInDays: number;
    }>;
  }>(manifest.files.household);

  await db
    .insert(households)
    .values({
      id: householdFile.household.id,
      name: householdFile.household.name,
      ownerUserId,
    })
    .onConflictDoUpdate({
      target: households.id,
      set: { name: householdFile.household.name },
    });

  for (const member of householdFile.members) {
    const linkedUserId = member.userEmail
      ? (emailToUserId.get(member.userEmail) ?? null)
      : null;

    await db
      .insert(householdMembers)
      .values({
        id: member.id,
        householdId: householdFile.household.id,
        userId: linkedUserId,
        displayName: member.displayName,
        role: member.role,
        avatarColor: member.avatarColor,
      })
      .onConflictDoUpdate({
        target: householdMembers.id,
        set: {
          userId: linkedUserId,
          displayName: member.displayName,
          role: member.role,
          avatarColor: member.avatarColor,
        },
      });
  }

  for (const assignment of householdFile.accountAssignments) {
    await db
      .insert(householdAccountAssignments)
      .values({
        accountId: assignment.accountId,
        memberId: assignment.memberId,
        householdId: householdFile.household.id,
      })
      .onConflictDoNothing();
  }

  for (const invite of householdFile.invitations) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + invite.expiresInDays);

    await db
      .insert(householdInvitations)
      .values({
        householdId: householdFile.household.id,
        memberId: invite.memberId,
        email: invite.email,
        token: invite.token,
        invitedByUserId: ownerUserId,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: householdInvitations.token,
        set: {
          email: invite.email,
          expiresAt,
        },
      });
  }

  console.log(`Household: ${householdFile.household.name}`);

  const [countRow] = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count FROM transactions WHERE user_id = ${ownerUserId}
  `);

  console.log("");
  console.log("Seed complete.");
  console.log(`  Dev user:    ${manifest.devUserEmail} (id ${ownerUserId})`);
  console.log(`  Partner:     ${manifest.partnerUserEmail}`);
  console.log(`  Transactions: ${countRow?.count ?? "0"}`);
  console.log("");
  console.log("UI: set NEXT_PUBLIC_USE_MOCKS=false in ui/.env.local");
  console.log("API: AUTH_ALLOW_DEV_USER=true uses the dev user without Google sign-in");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
