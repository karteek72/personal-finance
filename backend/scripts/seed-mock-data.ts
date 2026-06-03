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
  budgets,
  challenges,
  coachInsights,
  creditCardLiabilities,
  fireProfiles,
  habitStreaks,
  holdings,
  householdAccountAssignments,
  householdInvitations,
  householdMembers,
  households,
  inflationCategories,
  inflationProfiles,
  investmentTransactions,
  lifestyleHabits,
  merchantCategoryRules,
  netWorthSnapshots,
  plaidItems,
  recurringSeries,
  resilienceProfiles,
  resilienceScenarios,
  savingsGoals,
  securities,
  spendingDna,
  spendingPatterns,
  transactionReasons,
  transactions,
  users,
  wellnessScores,
  wrappedSummaries,
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
  type: "credit" | "depository" | "investment";
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
  const txnFile = readJson<{ items: SeedTransaction[] }>(
    manifest.files.transactions,
  );

  const txnRows: Array<typeof transactions.$inferInsert> = txnFile.items.map(
    (txn) => ({
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
    }),
  );

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

  /* ---------------- investments ---------------- */

  const securitiesFile = readJson<{
    securities: Array<{
      id: string;
      ticker: string;
      name: string;
      assetType: string;
      sector: string | null;
      currentPrice: string;
      currencyCode: string;
    }>;
  }>(manifest.files.securities);

  for (const sec of securitiesFile.securities) {
    await db
      .insert(securities)
      .values({
        id: sec.id,
        ticker: sec.ticker,
        name: sec.name,
        assetType: sec.assetType,
        sector: sec.sector,
        currentPrice: sec.currentPrice,
        currencyCode: sec.currencyCode,
      })
      .onConflictDoUpdate({
        target: securities.ticker,
        set: { currentPrice: sec.currentPrice, asOf: new Date() },
      });
  }
  console.log(`Securities: ${securitiesFile.securities.length}`);

  const holdingsFile = readJson<{
    holdings: Array<{
      accountId: string;
      securityId: string;
      quantity: string;
      costBasis: string;
      institutionValue: string | null;
    }>;
  }>(manifest.files.holdings);

  for (const h of holdingsFile.holdings) {
    await db
      .insert(holdings)
      .values({
        userId: ownerUserId,
        accountId: h.accountId,
        securityId: h.securityId,
        quantity: h.quantity,
        costBasis: h.costBasis,
        institutionValue: h.institutionValue,
      })
      .onConflictDoUpdate({
        target: [holdings.accountId, holdings.securityId],
        set: { quantity: h.quantity, institutionValue: h.institutionValue },
      });
  }
  console.log(`Holdings: ${holdingsFile.holdings.length}`);

  const investmentTxnFile = readJson<{
    items: Array<{
      id: string;
      accountId: string;
      securityId: string | null;
      externalId: string;
      date: string;
      name: string;
      type: string;
      quantity: string | null;
      price: string | null;
      amount: string;
      fees: string;
    }>;
  }>(manifest.files.investmentTransactions);

  for (const t of investmentTxnFile.items) {
    await db
      .insert(investmentTransactions)
      .values({
        id: t.id,
        userId: ownerUserId,
        accountId: t.accountId,
        securityId: t.securityId,
        externalId: t.externalId,
        date: t.date,
        name: t.name,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        amount: t.amount,
        fees: t.fees,
      })
      .onConflictDoUpdate({
        target: [
          investmentTransactions.accountId,
          investmentTransactions.externalId,
        ],
        set: { amount: t.amount, quantity: t.quantity, price: t.price },
      });
  }
  console.log(`Investment txns: ${investmentTxnFile.items.length}`);

  /* ---------------- planning ---------------- */

  const netWorthFile = readJson<{
    snapshots: Array<{
      month: string;
      totalAssets: string;
      totalLiabilities: string;
      netWorth: string;
      breakdown: unknown;
    }>;
  }>(manifest.files.netWorthSnapshots);
  for (const s of netWorthFile.snapshots) {
    await db
      .insert(netWorthSnapshots)
      .values({
        userId: ownerUserId,
        month: s.month,
        totalAssets: s.totalAssets,
        totalLiabilities: s.totalLiabilities,
        netWorth: s.netWorth,
        breakdown: s.breakdown,
      })
      .onConflictDoUpdate({
        target: [netWorthSnapshots.userId, netWorthSnapshots.month],
        set: { netWorth: s.netWorth, breakdown: s.breakdown },
      });
  }
  console.log(`Net worth snapshots: ${netWorthFile.snapshots.length}`);

  const budgetsFile = readJson<{
    budgets: Array<{
      category: string;
      periodMonth: string;
      limitAmount: string;
      emoji: string | null;
      color: string | null;
    }>;
  }>(manifest.files.budgets);
  for (const b of budgetsFile.budgets) {
    await db
      .insert(budgets)
      .values({
        userId: ownerUserId,
        category: b.category,
        periodMonth: b.periodMonth,
        limitAmount: b.limitAmount,
        emoji: b.emoji,
        color: b.color,
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.category, budgets.periodMonth],
        set: { limitAmount: b.limitAmount },
      });
  }
  console.log(`Budgets: ${budgetsFile.budgets.length}`);

  const goalsFile = readJson<{
    goals: Array<{
      name: string;
      targetAmount: string;
      currentAmount: string;
      deadline: string | null;
      emoji: string | null;
      color: string | null;
    }>;
  }>(manifest.files.savingsGoals);
  await db.delete(savingsGoals).where(eq(savingsGoals.userId, ownerUserId));
  for (const g of goalsFile.goals) {
    await db.insert(savingsGoals).values({
      userId: ownerUserId,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      deadline: g.deadline,
      emoji: g.emoji,
      color: g.color,
    });
  }
  console.log(`Savings goals: ${goalsFile.goals.length}`);

  const recurringFile = readJson<{
    series: Array<{
      merchantName: string;
      category: string;
      kind: string;
      amount: string;
      cadence: string;
      nextChargeDate: string | null;
      lastChargeDate: string | null;
      previousAmount: string | null;
      priceChanged: boolean;
      status: string;
      brandColor: string | null;
    }>;
  }>(manifest.files.recurringSeries);
  await db.delete(recurringSeries).where(eq(recurringSeries.userId, ownerUserId));
  for (const r of recurringFile.series) {
    await db.insert(recurringSeries).values({
      userId: ownerUserId,
      merchantName: r.merchantName,
      category: r.category,
      kind: r.kind,
      amount: r.amount,
      cadence: r.cadence,
      nextChargeDate: r.nextChargeDate,
      lastChargeDate: r.lastChargeDate,
      previousAmount: r.previousAmount,
      priceChanged: r.priceChanged,
      status: r.status,
      brandColor: r.brandColor,
    });
  }
  console.log(`Recurring series: ${recurringFile.series.length}`);

  const fireFile = readJson<{
    currentAge: number;
    currentNetWorth: string;
    monthlySpend: string;
    monthlyInvest: string;
    withdrawalRate: number;
    realReturn: number;
  }>(manifest.files.fireProfile);
  await db
    .insert(fireProfiles)
    .values({
      userId: ownerUserId,
      currentAge: fireFile.currentAge,
      currentNetWorth: fireFile.currentNetWorth,
      monthlySpend: fireFile.monthlySpend,
      monthlyInvest: fireFile.monthlyInvest,
      withdrawalRate: String(fireFile.withdrawalRate),
      realReturn: String(fireFile.realReturn),
    })
    .onConflictDoUpdate({
      target: fireProfiles.userId,
      set: {
        currentNetWorth: fireFile.currentNetWorth,
        monthlySpend: fireFile.monthlySpend,
        updatedAt: new Date(),
      },
    });

  /* ---------------- insights ---------------- */

  const wellnessFile = readJson<{
    scores: Array<{ periodMonth: string; score: number; dimensions: unknown }>;
  }>(manifest.files.wellnessScores);
  for (const w of wellnessFile.scores) {
    await db
      .insert(wellnessScores)
      .values({
        userId: ownerUserId,
        periodMonth: w.periodMonth,
        score: w.score,
        dimensions: w.dimensions,
      })
      .onConflictDoUpdate({
        target: [wellnessScores.userId, wellnessScores.periodMonth],
        set: { score: w.score, dimensions: w.dimensions },
      });
  }
  console.log(`Wellness scores: ${wellnessFile.scores.length}`);

  const dnaFile = readJson<{
    archetype: string;
    narrative: string;
    peerRarity: string | null;
    axes: unknown;
  }>(manifest.files.spendingDna);
  await db
    .insert(spendingDna)
    .values({
      userId: ownerUserId,
      archetype: dnaFile.archetype,
      narrative: dnaFile.narrative,
      peerRarity: dnaFile.peerRarity,
      axes: dnaFile.axes,
    })
    .onConflictDoUpdate({
      target: spendingDna.userId,
      set: { archetype: dnaFile.archetype, axes: dnaFile.axes, updatedAt: new Date() },
    });

  const patternsFile = readJson<{
    patterns: Array<{
      kind: string;
      label: string;
      metric: string | null;
      description: string | null;
      severity: string | null;
      sortOrder: number;
    }>;
  }>(manifest.files.spendingPatterns);
  await db.delete(spendingPatterns).where(eq(spendingPatterns.userId, ownerUserId));
  for (const p of patternsFile.patterns) {
    await db.insert(spendingPatterns).values({ userId: ownerUserId, ...p });
  }
  console.log(`Spending patterns: ${patternsFile.patterns.length}`);

  const reasonsFile = readJson<{
    reasons: Array<{ transactionId: string; reasonId: string }>;
  }>(manifest.files.transactionReasons);
  for (const r of reasonsFile.reasons) {
    await db
      .insert(transactionReasons)
      .values({
        transactionId: r.transactionId,
        userId: ownerUserId,
        reasonId: r.reasonId,
      })
      .onConflictDoUpdate({
        target: transactionReasons.transactionId,
        set: { reasonId: r.reasonId },
      });
  }
  console.log(`Transaction reasons: ${reasonsFile.reasons.length}`);

  const challengesFile = readJson<{
    challenges: Array<{
      title: string;
      goal: string;
      progressPercent: number;
      daysRemaining: number;
      complete: boolean;
      color: string | null;
    }>;
  }>(manifest.files.challenges);
  await db.delete(challenges).where(eq(challenges.userId, ownerUserId));
  for (const c of challengesFile.challenges) {
    await db.insert(challenges).values({ userId: ownerUserId, ...c });
  }

  const streaksFile = readJson<{
    streaks: Array<{
      label: string;
      currentDays: number;
      maxDays: number;
      color: string | null;
    }>;
  }>(manifest.files.habitStreaks);
  await db.delete(habitStreaks).where(eq(habitStreaks.userId, ownerUserId));
  for (const s of streaksFile.streaks) {
    await db.insert(habitStreaks).values({ userId: ownerUserId, ...s });
  }

  const habitsFile = readJson<{
    habits: Array<{
      category: string;
      emoji: string | null;
      label: string;
      monthlyAmount: string;
    }>;
  }>(manifest.files.lifestyleHabits);
  await db.delete(lifestyleHabits).where(eq(lifestyleHabits.userId, ownerUserId));
  for (const h of habitsFile.habits) {
    await db.insert(lifestyleHabits).values({ userId: ownerUserId, ...h });
  }

  /* ---------------- protect ---------------- */

  const inflProfileFile = readJson<{
    personalRate: number;
    nationalCpi: number;
    salary: number;
    raisePercent: number;
    nominalSavingsRate: number;
    powerLoss: number;
    baseDate: string | null;
  }>(manifest.files.inflationProfile);
  await db
    .insert(inflationProfiles)
    .values({
      userId: ownerUserId,
      personalRate: String(inflProfileFile.personalRate),
      nationalCpi: String(inflProfileFile.nationalCpi),
      salary: String(inflProfileFile.salary),
      raisePercent: String(inflProfileFile.raisePercent),
      nominalSavingsRate: String(inflProfileFile.nominalSavingsRate),
      powerLoss: String(inflProfileFile.powerLoss),
      baseDate: inflProfileFile.baseDate,
    })
    .onConflictDoUpdate({
      target: inflationProfiles.userId,
      set: {
        personalRate: String(inflProfileFile.personalRate),
        updatedAt: new Date(),
      },
    });

  const inflCatsFile = readJson<{
    categories: Array<{
      name: string;
      share: number;
      inflationRate: number;
      severity: string;
      sortOrder: number;
    }>;
  }>(manifest.files.inflationCategories);
  await db
    .delete(inflationCategories)
    .where(eq(inflationCategories.userId, ownerUserId));
  for (const c of inflCatsFile.categories) {
    await db.insert(inflationCategories).values({
      userId: ownerUserId,
      name: c.name,
      share: String(c.share),
      inflationRate: String(c.inflationRate),
      severity: c.severity,
      sortOrder: c.sortOrder,
    });
  }
  console.log(`Inflation categories: ${inflCatsFile.categories.length}`);

  const resProfileFile = readJson<{ liquidCash: string; monthlyBurn: string }>(
    manifest.files.resilienceProfile,
  );
  await db
    .insert(resilienceProfiles)
    .values({
      userId: ownerUserId,
      liquidCash: resProfileFile.liquidCash,
      monthlyBurn: resProfileFile.monthlyBurn,
    })
    .onConflictDoUpdate({
      target: resilienceProfiles.userId,
      set: {
        liquidCash: resProfileFile.liquidCash,
        monthlyBurn: resProfileFile.monthlyBurn,
        updatedAt: new Date(),
      },
    });

  const resScenariosFile = readJson<{
    scenarios: Array<{
      name: string;
      emoji: string | null;
      shockAmount: string;
      shockType: string;
      recommendedMonths: number;
      detail: string | null;
      sortOrder: number;
    }>;
  }>(manifest.files.resilienceScenarios);
  await db
    .delete(resilienceScenarios)
    .where(eq(resilienceScenarios.userId, ownerUserId));
  for (const s of resScenariosFile.scenarios) {
    await db.insert(resilienceScenarios).values({
      userId: ownerUserId,
      name: s.name,
      emoji: s.emoji,
      shockAmount: s.shockAmount,
      shockType: s.shockType,
      recommendedMonths: String(s.recommendedMonths),
      detail: s.detail,
      sortOrder: s.sortOrder,
    });
  }
  console.log(`Resilience scenarios: ${resScenariosFile.scenarios.length}`);

  /* ---------------- coach & wrapped ---------------- */

  const coachFile = readJson<{
    insights: Array<{
      kind: string;
      periodMonth: string | null;
      question: string | null;
      answer: string;
      sortOrder: number;
    }>;
  }>(manifest.files.coachInsights);
  await db.delete(coachInsights).where(eq(coachInsights.userId, ownerUserId));
  for (const c of coachFile.insights) {
    await db.insert(coachInsights).values({ userId: ownerUserId, ...c });
  }

  const wrappedFile = readJson<{
    summaries: Array<{
      year: number;
      totalSpent: string;
      transactionCount: number;
      totalSaved: string;
      savingsRate: number;
      peerPercentile: string | null;
      archetype: string | null;
      topCategory: unknown;
      personality: unknown;
      moments: unknown;
    }>;
  }>(manifest.files.wrappedSummaries);
  for (const w of wrappedFile.summaries) {
    await db
      .insert(wrappedSummaries)
      .values({
        userId: ownerUserId,
        year: w.year,
        totalSpent: w.totalSpent,
        transactionCount: w.transactionCount,
        totalSaved: w.totalSaved,
        savingsRate: String(w.savingsRate),
        peerPercentile: w.peerPercentile,
        archetype: w.archetype,
        topCategory: w.topCategory,
        personality: w.personality,
        moments: w.moments,
      })
      .onConflictDoUpdate({
        target: [wrappedSummaries.userId, wrappedSummaries.year],
        set: { totalSpent: w.totalSpent, moments: w.moments },
      });
  }
  console.log(`Wrapped summaries: ${wrappedFile.summaries.length}`);

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
