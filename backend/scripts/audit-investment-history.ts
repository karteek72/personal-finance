import { sql, eq } from "drizzle-orm";

import { getDb } from "../src/db/client.js";
import { investmentTransactions, users } from "../src/db/schema.js";
import { buildInvestmentHistorySummary } from "../src/services/investment-analytics.js";

async function main(): Promise<void> {
  const db = getDb();
  const allUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);

  console.log("users:", allUsers);

  for (const u of allUsers) {
    const counts = await db
      .select({
        type: investmentTransactions.type,
        c: sql<number>`count(*)::int`,
      })
      .from(investmentTransactions)
      .where(eq(investmentTransactions.userId, u.id))
      .groupBy(investmentTransactions.type);

    const total = counts.reduce((s, r) => s + r.c, 0);
    if (total === 0) continue;

    console.log(
      `\nuser ${u.email ?? u.id} txns:`,
      Object.fromEntries(counts.map((r) => [r.type, r.c])),
    );
    const hist = await buildInvestmentHistorySummary([u.id]);
    console.log("history:", hist);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
