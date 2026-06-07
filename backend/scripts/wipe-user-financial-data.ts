/**
 * Remove all financial and feature data for a user while keeping the login row.
 *
 * Usage (from backend/):
 *   npm run db:wipe-user -- you@example.com
 *   WIPE_USER_EMAIL=you@example.com npm run db:wipe-user
 *
 * With a single user in the DB, email can be omitted.
 */
import { loadRootEnv } from "../src/config/load-root-env.js";
import { eq, sql } from "drizzle-orm";
import { loadEnv } from "../src/config/env.js";
import { closeDb, getDb } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { accounts, households, plaidItems, transactions, users } from "../src/db/schema.js";
import { disconnectPlaidItem } from "../src/services/plaid/disconnect-item.js";
import { purgeDerivedFinancialData } from "../src/services/purge-derived-financial-data.js";

loadRootEnv();

async function resolveTargetUser(emailArg?: string) {
  const db = getDb();
  const email = emailArg?.trim() || process.env.WIPE_USER_EMAIL?.trim();

  if (email) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user) {
      throw new Error(`No user found with email ${email}`);
    }
    return user;
  }

  const allUsers = await db.select().from(users);
  if (allUsers.length === 1) {
    return allUsers[0]!;
  }
  if (allUsers.length === 0) {
    throw new Error("No users in database.");
  }
  throw new Error(
    `Multiple users found. Pass email: npm run db:wipe-user -- your@email.com`,
  );
}

async function main(): Promise<void> {
  const emailArg = process.argv[2];
  const env = loadEnv();
  await runMigrations(env.DATABASE_URL);

  const user = await resolveTargetUser(emailArg);
  const db = getDb();
  const userId = user.id;

  console.log(`Wiping financial data for ${user.email} (${userId})…`);

  const items = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.userId, userId));

  for (const item of items) {
    await disconnectPlaidItem(item.id, userId, env);
  }
  if (items.length > 0) {
    console.log(`Disconnected ${items.length} Plaid item(s).`);
  }

  const accountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  if (accountRows.length > 0) {
    await db.delete(accounts).where(eq(accounts.userId, userId));
    console.log(`Deleted ${accountRows.length} account(s) and cascaded transactions.`);
  }

  const ownedHouseholds = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.ownerUserId, userId));
  if (ownedHouseholds.length > 0) {
    await db.delete(households).where(eq(households.ownerUserId, userId));
    console.log(`Deleted ${ownedHouseholds.length} household(s).`);
  }

  await purgeDerivedFinancialData(userId);
  console.log("Purged derived feature tables.");

  const [txnCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  if ((txnCount?.count ?? 0) > 0) {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    console.log(`Removed ${txnCount?.count ?? 0} orphaned transaction(s).`);
  }

  const [remainingAccounts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  console.log(
    `Done. User ${user.email} kept; ${remainingAccounts?.count ?? 0} accounts remaining.`,
  );
  console.log("Hard refresh the UI (or sign out/in) to clear cached KPIs.");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
