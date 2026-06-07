/**
 * One-time migration: attach all legacy accounts/transactions to the real signed-in user.
 *
 * Usage:
 *   npm run db:assign-legacy -- you@gmail.com
 *   ASSIGN_TO_EMAIL=you@gmail.com npm run db:assign-legacy
 *
 * If email is omitted, uses the only user with a Google account (google_sub set).
 */
import { loadRootEnv } from "../src/config/load-root-env.js";
import { eq, inArray, ne, sql } from "drizzle-orm";
import { loadEnv } from "../src/config/env.js";
import { closeDb, getDb } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import {
  accounts,
  householdAccountAssignments,
  householdMembers,
  households,
  plaidItems,
  transactions,
  users,
} from "../src/db/schema.js";
import { DEV_USER_EMAIL } from "../src/services/user-store.js";
import { getHouseholdForUser } from "../src/services/household-store.js";

loadRootEnv();
loadEnv();

async function resolveTargetUser(emailArg?: string) {
  const db = getDb();
  const email = emailArg?.trim() || process.env.ASSIGN_TO_EMAIL?.trim();

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

  const googleUsers = await db
    .select()
    .from(users)
    .where(sql`${users.googleSub} IS NOT NULL`);

  if (googleUsers.length === 1) {
    return googleUsers[0]!;
  }

  if (googleUsers.length > 1) {
    throw new Error(
      `Multiple Google users found. Pass email: npm run db:assign-legacy -- your@email.com`,
    );
  }

  const allUsers = await db.select().from(users);
  const nonDev = allUsers.filter((u) => u.email !== DEV_USER_EMAIL);
  if (nonDev.length === 1) {
    return nonDev[0]!;
  }

  throw new Error(
    "Could not determine target user. Pass email: npm run db:assign-legacy -- your@email.com",
  );
}

async function main(): Promise<void> {
  const emailArg = process.argv[2];
  await runMigrations();
  const db = getDb();

  const target = await resolveTargetUser(emailArg);
  const sourceUsers = await db
    .select()
    .from(users)
    .where(ne(users.id, target.id));

  if (sourceUsers.length === 0) {
    console.log(`Nothing to migrate — all data already belongs to ${target.email}`);
    await getHouseholdForUser(target.id);
    return;
  }

  const sourceIds = sourceUsers.map((u) => u.id);
  console.log(`Target user: ${target.email} (${target.id})`);
  console.log(
    `Reassigning from: ${sourceUsers.map((u) => u.email).join(", ")}`,
  );

  await db.transaction(async (tx) => {
    const accountRows = await tx
      .update(accounts)
      .set({ userId: target.id })
      .where(inArray(accounts.userId, sourceIds))
      .returning({ id: accounts.id });

    const txnRows = await tx
      .update(transactions)
      .set({ userId: target.id })
      .where(inArray(transactions.userId, sourceIds))
      .returning({ id: transactions.id });

    await tx
      .update(plaidItems)
      .set({ userId: target.id })
      .where(inArray(plaidItems.userId, sourceIds));

    await tx
      .update(households)
      .set({ ownerUserId: target.id })
      .where(inArray(households.ownerUserId, sourceIds));

    await tx
      .update(householdMembers)
      .set({ userId: target.id })
      .where(inArray(householdMembers.userId, sourceIds));

    console.log(
      `Reassigned ${accountRows.length} accounts and ${txnRows.length} transactions`,
    );

    await tx.delete(users).where(inArray(users.id, sourceIds));
  });

  // Remove duplicate empty households (e.g. auto-created on first Google login).
  const ownedHouseholds = await db
    .select()
    .from(households)
    .where(eq(households.ownerUserId, target.id));

  for (const household of ownedHouseholds) {
    const [assignment] = await db
      .select({ accountId: householdAccountAssignments.accountId })
      .from(householdAccountAssignments)
      .where(eq(householdAccountAssignments.householdId, household.id))
      .limit(1);

    const [member] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, household.id))
      .limit(1);

    if (!assignment && !member) {
      await db.delete(households).where(eq(households.id, household.id));
      console.log(`Removed empty duplicate household ${household.id}`);
    }
  }

  await getHouseholdForUser(target.id);

  const [stats] = await db.execute<{
    accounts: string;
    transactions: string;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM accounts WHERE user_id = ${target.id}) AS accounts,
      (SELECT COUNT(*)::text FROM transactions WHERE user_id = ${target.id}) AS transactions
  `);

  console.log(
    `Done. ${target.email} now owns ${stats?.accounts ?? "0"} accounts and ${stats?.transactions ?? "0"} transactions.`,
  );
  console.log("New sign-ups will start with zero accounts and transactions.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
