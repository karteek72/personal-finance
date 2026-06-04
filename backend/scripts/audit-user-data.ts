/**
 * Audit remaining data for a user email.
 * Usage: npx tsx scripts/audit-user-data.ts karteek.chenna@gmail.com
 */
import { config as loadDotenv } from "dotenv";
import { eq, inArray, sql } from "drizzle-orm";
import { resolve } from "node:path";
import { loadEnv } from "../src/config/env.js";
import { closeDb, getDb } from "../src/db/client.js";
import {
  accounts,
  budgets,
  fireProfiles,
  holdings,
  households,
  householdMembers,
  inflationProfiles,
  netWorthSnapshots,
  recurringSeries,
  resilienceProfiles,
  spendingDna,
  spendingPatterns,
  transactions,
  users,
  wellnessScores,
} from "../src/db/schema.js";
import { resolveHouseholdContext } from "../src/services/household-access.js";
import { getActiveAccountIds } from "../src/services/active-account-scope.js";

loadDotenv({ path: resolve(process.cwd(), "../.env") });
loadDotenv({ path: resolve(process.cwd(), ".env") });
loadEnv();

async function countForUser(
  table: string,
  userId: string,
  query: () => Promise<{ c: number }[]>,
): Promise<void> {
  const [row] = await query();
  console.log(`  ${table}: ${row?.c ?? 0}`);
}

async function main(): Promise<void> {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Usage: npx tsx scripts/audit-user-data.ts <email>");
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  console.log("\n=== All users ===");
  const allUsers = await db
    .select({ id: users.id, email: users.email, googleSub: users.googleSub })
    .from(users);
  for (const u of allUsers) {
    console.log(`  ${u.email} (${u.id})`);
  }

  if (!user) {
    console.log(`\nNo user found for ${email}`);
    await closeDb();
    return;
  }

  console.log(`\n=== User: ${user.email} (${user.id}) ===`);

  const uid = user.id;
  console.log("\nDirect user_id tables:");
  await countForUser("accounts (all)", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(accounts)
      .where(eq(accounts.userId, uid)),
  );
  await countForUser("accounts (active)", uid, async () => {
    const ids = await getActiveAccountIds([uid]);
    return [{ c: ids.length }];
  });
  await countForUser("transactions", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.userId, uid)),
  );
  await countForUser("fire_profiles", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(fireProfiles)
      .where(eq(fireProfiles.userId, uid)),
  );
  await countForUser("spending_dna", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(spendingDna)
      .where(eq(spendingDna.userId, uid)),
  );
  await countForUser("spending_patterns", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(spendingPatterns)
      .where(eq(spendingPatterns.userId, uid)),
  );
  await countForUser("wellness_scores", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(wellnessScores)
      .where(eq(wellnessScores.userId, uid)),
  );
  await countForUser("budgets", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(budgets)
      .where(eq(budgets.userId, uid)),
  );
  await countForUser("recurring_series", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(recurringSeries)
      .where(eq(recurringSeries.userId, uid)),
  );
  await countForUser("inflation_profiles", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(inflationProfiles)
      .where(eq(inflationProfiles.userId, uid)),
  );
  await countForUser("resilience_profiles", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(resilienceProfiles)
      .where(eq(resilienceProfiles.userId, uid)),
  );
  await countForUser("net_worth_snapshots", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, uid)),
  );
  await countForUser("holdings", uid, () =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(holdings)
      .where(eq(holdings.userId, uid)),
  );

  const ctx = await resolveHouseholdContext(uid);
  console.log("\nHousehold context:");
  console.log(`  householdId: ${ctx.householdId}`);
  console.log(`  userIds in scope: ${ctx.userIds.join(", ")}`);

  const members = await db
    .select({
      email: users.email,
      memberId: householdMembers.id,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .leftJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, ctx.householdId));
  console.log("  members:");
  for (const m of members) {
    console.log(`    ${m.role}: ${m.email ?? "(no login)"} member=${m.memberId}`);
  }

  if (ctx.userIds.length > 1) {
    console.log("\n*** HOUSEHOLD includes other user IDs — APIs aggregate their data ***");
    for (const otherId of ctx.userIds) {
      if (otherId === uid) continue;
      const [other] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, otherId))
        .limit(1);
      console.log(`\n  Other household user: ${other?.email ?? otherId}`);
      await countForUser("    accounts", otherId, () =>
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(accounts)
          .where(eq(accounts.userId, otherId)),
      );
      await countForUser("    transactions", otherId, () =>
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(transactions)
          .where(eq(transactions.userId, otherId)),
      );
      await countForUser("    fire_profiles", otherId, () =>
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(fireProfiles)
          .where(eq(fireProfiles.userId, otherId)),
      );
    }
  }

  const activeInHousehold = await getActiveAccountIds(ctx.userIds);
  console.log(`\nActive accounts in household scope: ${activeInHousehold.length}`);

  console.log("");
  await closeDb();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
