import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  budgets,
  challenges,
  coachInsights,
  fireProfiles,
  habitStreaks,
  importBatches,
  inflationCategories,
  inflationProfiles,
  lifestyleHabits,
  merchantCategoryRules,
  netWorthSnapshots,
  recurringSeries,
  resilienceProfiles,
  resilienceScenarios,
  savingsGoals,
  spendingDna,
  spendingPatterns,
  transferLinks,
  userAlerts,
  wellnessScores,
  wrappedSummaries,
} from "../db/schema.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("purge-derived-data");

/**
 * Removes seeded / snapshot feature data for a user. Does not delete accounts,
 * transactions, Plaid items, holdings, investment transactions, or the user row.
 * Holdings are scoped to accounts and cascade on account delete — do not wipe them
 * here or unrelated brokerage positions disappear when a bank account is removed.
 */
export async function purgeDerivedFinancialData(userId: string): Promise<void> {
  const db = getDb();

  const tables: Array<[string, () => Promise<unknown>]> = [
    ["import_batches", () => db.delete(importBatches).where(eq(importBatches.userId, userId))],
    [
      "merchant_category_rules",
      () =>
        db
          .delete(merchantCategoryRules)
          .where(eq(merchantCategoryRules.userId, userId)),
    ],
    ["budgets", () => db.delete(budgets).where(eq(budgets.userId, userId))],
    ["savings_goals", () => db.delete(savingsGoals).where(eq(savingsGoals.userId, userId))],
    [
      "recurring_series",
      () => db.delete(recurringSeries).where(eq(recurringSeries.userId, userId)),
    ],
    ["fire_profiles", () => db.delete(fireProfiles).where(eq(fireProfiles.userId, userId))],
    [
      "net_worth_snapshots",
      () => db.delete(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId)),
    ],
    [
      "transfer_links",
      () => db.delete(transferLinks).where(eq(transferLinks.userId, userId)),
    ],
    [
      "wellness_scores",
      () => db.delete(wellnessScores).where(eq(wellnessScores.userId, userId)),
    ],
    ["spending_dna", () => db.delete(spendingDna).where(eq(spendingDna.userId, userId))],
    [
      "spending_patterns",
      () => db.delete(spendingPatterns).where(eq(spendingPatterns.userId, userId)),
    ],
    ["challenges", () => db.delete(challenges).where(eq(challenges.userId, userId))],
    ["habit_streaks", () => db.delete(habitStreaks).where(eq(habitStreaks.userId, userId))],
    [
      "lifestyle_habits",
      () => db.delete(lifestyleHabits).where(eq(lifestyleHabits.userId, userId)),
    ],
    [
      "inflation_categories",
      () =>
        db.delete(inflationCategories).where(eq(inflationCategories.userId, userId)),
    ],
    [
      "inflation_profiles",
      () => db.delete(inflationProfiles).where(eq(inflationProfiles.userId, userId)),
    ],
    [
      "resilience_scenarios",
      () =>
        db.delete(resilienceScenarios).where(eq(resilienceScenarios.userId, userId)),
    ],
    [
      "resilience_profiles",
      () => db.delete(resilienceProfiles).where(eq(resilienceProfiles.userId, userId)),
    ],
    ["user_alerts", () => db.delete(userAlerts).where(eq(userAlerts.userId, userId))],
    ["coach_insights", () => db.delete(coachInsights).where(eq(coachInsights.userId, userId))],
    [
      "wrapped_summaries",
      () => db.delete(wrappedSummaries).where(eq(wrappedSummaries.userId, userId)),
    ],
  ];

  for (const [name, run] of tables) {
    await run();
    log.debug({ userId, table: name }, "purged derived financial rows");
  }

  log.info({ userId }, "purged derived financial data for user");
}
