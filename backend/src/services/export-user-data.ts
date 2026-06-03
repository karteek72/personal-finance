import { eq, inArray } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import { getDb as getDatabase } from "../db/client.js";
import {
  accounts,
  auditEvents,
  budgets,
  challenges,
  coachInsights,
  consentRecords,
  creditCardLiabilities,
  fireProfiles,
  habitStreaks,
  holdings,
  householdAccountAssignments,
  householdInvitations,
  householdMembers,
  households,
  importBatches,
  importFiles,
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
} from "../db/schema.js";
import { serializeUser } from "./auth/user-auth.js";

export const EXPORT_VERSION = "1.0";

/** Keys that must never appear in a portable export payload. */
export const FORBIDDEN_EXPORT_KEYS = new Set([
  "accessTokenEncrypted",
  "access_token_encrypted",
  "contentEncrypted",
  "content_encrypted",
  "parsedPreview",
  "parsed_preview",
  "token",
  "cursor",
  "password",
  "passwordHash",
  "refreshToken",
  "accessToken",
]);

export interface UserDataExport {
  exportedAt: string;
  exportVersion: string;
  user: ReturnType<typeof serializeUser>;
  accounts: Record<string, unknown>[];
  plaidConnections: Record<string, unknown>[];
  creditCardLiabilities: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  investmentTransactions: Record<string, unknown>[];
  holdings: Record<string, unknown>[];
  merchantCategoryRules: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  savingsGoals: Record<string, unknown>[];
  recurringSeries: Record<string, unknown>[];
  fireProfile: Record<string, unknown> | null;
  netWorthSnapshots: Record<string, unknown>[];
  wellnessScores: Record<string, unknown>[];
  spendingDna: Record<string, unknown> | null;
  spendingPatterns: Record<string, unknown>[];
  transactionReasons: Record<string, unknown>[];
  challenges: Record<string, unknown>[];
  habitStreaks: Record<string, unknown>[];
  lifestyleHabits: Record<string, unknown>[];
  inflationProfile: Record<string, unknown> | null;
  inflationCategories: Record<string, unknown>[];
  resilienceProfile: Record<string, unknown> | null;
  resilienceScenarios: Record<string, unknown>[];
  coachInsights: Record<string, unknown>[];
  wrappedSummaries: Record<string, unknown>[];
  households: Record<string, unknown>[];
  householdMembers: Record<string, unknown>[];
  householdAccountAssignments: Record<string, unknown>[];
  householdInvitations: Record<string, unknown>[];
  importBatches: Record<string, unknown>[];
  importFiles: Record<string, unknown>[];
  consentRecords: Record<string, unknown>[];
  auditEvents: Record<string, unknown>[];
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (value === null || value === undefined) {
      out[key] = null;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function assertExportHasNoSecrets(
  value: unknown,
  path = "export",
): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertExportHasNoSecrets(value[i], `${path}[${i}]`);
    }
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_EXPORT_KEYS.has(key)) {
      throw new Error(`Forbidden export field "${key}" at ${path}`);
    }
    assertExportHasNoSecrets(nested, `${path}.${key}`);
  }
}

export async function buildUserDataExport(
  userId: string,
  db: ReturnType<typeof getDb> = getDatabase(),
): Promise<UserDataExport> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const accountIds = userAccounts.map((a) => a.id);

  const [
    plaidConnections,
    txnRows,
    investmentTxnRows,
    holdingsRows,
    rules,
    budgetRows,
    goalRows,
    recurringRows,
    fireRow,
    netWorthRows,
    wellnessRows,
    dnaRow,
    patternRows,
    reasonRows,
    challengeRows,
    streakRows,
    habitRows,
    inflationRow,
    inflationCatRows,
    resilienceRow,
    scenarioRows,
    coachRows,
    wrappedRows,
    ownedHouseholds,
    batchRows,
    fileRows,
    consentRows,
    auditRows,
  ] = await Promise.all([
    db
      .select({
        id: plaidItems.id,
        institutionId: plaidItems.institutionId,
        institutionName: plaidItems.institutionName,
        status: plaidItems.status,
        lastSyncedAt: plaidItems.lastSyncedAt,
        createdAt: plaidItems.createdAt,
      })
      .from(plaidItems)
      .where(eq(plaidItems.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db
      .select({
        id: investmentTransactions.id,
        accountId: investmentTransactions.accountId,
        externalId: investmentTransactions.externalId,
        date: investmentTransactions.date,
        name: investmentTransactions.name,
        type: investmentTransactions.type,
        quantity: investmentTransactions.quantity,
        price: investmentTransactions.price,
        amount: investmentTransactions.amount,
        fees: investmentTransactions.fees,
        createdAt: investmentTransactions.createdAt,
        ticker: securities.ticker,
        securityName: securities.name,
        assetType: securities.assetType,
      })
      .from(investmentTransactions)
      .leftJoin(
        securities,
        eq(investmentTransactions.securityId, securities.id),
      )
      .where(eq(investmentTransactions.userId, userId)),
    db
      .select({
        id: holdings.id,
        accountId: holdings.accountId,
        quantity: holdings.quantity,
        costBasis: holdings.costBasis,
        institutionValue: holdings.institutionValue,
        createdAt: holdings.createdAt,
        ticker: securities.ticker,
        securityName: securities.name,
        assetType: securities.assetType,
      })
      .from(holdings)
      .innerJoin(securities, eq(holdings.securityId, securities.id))
      .where(eq(holdings.userId, userId)),
    db
      .select()
      .from(merchantCategoryRules)
      .where(eq(merchantCategoryRules.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)),
    db.select().from(recurringSeries).where(eq(recurringSeries.userId, userId)),
    db.select().from(fireProfiles).where(eq(fireProfiles.userId, userId)).limit(1),
    db
      .select()
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId)),
    db.select().from(wellnessScores).where(eq(wellnessScores.userId, userId)),
    db.select().from(spendingDna).where(eq(spendingDna.userId, userId)).limit(1),
    db
      .select()
      .from(spendingPatterns)
      .where(eq(spendingPatterns.userId, userId)),
    db
      .select()
      .from(transactionReasons)
      .where(eq(transactionReasons.userId, userId)),
    db.select().from(challenges).where(eq(challenges.userId, userId)),
    db.select().from(habitStreaks).where(eq(habitStreaks.userId, userId)),
    db.select().from(lifestyleHabits).where(eq(lifestyleHabits.userId, userId)),
    db
      .select()
      .from(inflationProfiles)
      .where(eq(inflationProfiles.userId, userId))
      .limit(1),
    db
      .select()
      .from(inflationCategories)
      .where(eq(inflationCategories.userId, userId)),
    db
      .select()
      .from(resilienceProfiles)
      .where(eq(resilienceProfiles.userId, userId))
      .limit(1),
    db
      .select()
      .from(resilienceScenarios)
      .where(eq(resilienceScenarios.userId, userId)),
    db.select().from(coachInsights).where(eq(coachInsights.userId, userId)),
    db.select().from(wrappedSummaries).where(eq(wrappedSummaries.userId, userId)),
    db.select().from(households).where(eq(households.ownerUserId, userId)),
    db.select().from(importBatches).where(eq(importBatches.userId, userId)),
    db
      .select({
        id: importFiles.id,
        batchId: importFiles.batchId,
        filename: importFiles.filename,
        format: importFiles.format,
        byteSize: importFiles.byteSize,
        status: importFiles.status,
        errorMessage: importFiles.errorMessage,
        createdAt: importFiles.createdAt,
        parsedAt: importFiles.parsedAt,
      })
      .from(importFiles)
      .where(eq(importFiles.userId, userId)),
    db.select().from(consentRecords).where(eq(consentRecords.userId, userId)),
    db.select().from(auditEvents).where(eq(auditEvents.userId, userId)),
  ]);

  let liabilityRows: (typeof creditCardLiabilities.$inferSelect)[] = [];
  if (accountIds.length > 0) {
    liabilityRows = await db
      .select()
      .from(creditCardLiabilities)
      .where(inArray(creditCardLiabilities.accountId, accountIds));
  }

  const householdIds = ownedHouseholds.map((h) => h.id);
  let memberRows: (typeof householdMembers.$inferSelect)[] = [];
  let assignmentRows: (typeof householdAccountAssignments.$inferSelect)[] = [];
  let invitationRows: {
    id: string;
    householdId: string;
    memberId: string;
    email: string;
    invitedByUserId: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
  }[] = [];

  if (householdIds.length > 0) {
    memberRows = await db
      .select()
      .from(householdMembers)
      .where(inArray(householdMembers.householdId, householdIds));

    assignmentRows = await db
      .select()
      .from(householdAccountAssignments)
      .where(inArray(householdAccountAssignments.householdId, householdIds));

    invitationRows = await db
      .select({
        id: householdInvitations.id,
        householdId: householdInvitations.householdId,
        memberId: householdInvitations.memberId,
        email: householdInvitations.email,
        invitedByUserId: householdInvitations.invitedByUserId,
        expiresAt: householdInvitations.expiresAt,
        acceptedAt: householdInvitations.acceptedAt,
        createdAt: householdInvitations.createdAt,
      })
      .from(householdInvitations)
      .where(inArray(householdInvitations.householdId, householdIds));
  }

  const payload: UserDataExport = {
    exportedAt: new Date().toISOString(),
    exportVersion: EXPORT_VERSION,
    user: serializeUser(user),
    accounts: userAccounts.map((row) => serializeRow(row as Record<string, unknown>)),
    plaidConnections: plaidConnections.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    creditCardLiabilities: liabilityRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    transactions: txnRows.map((row) => serializeRow(row as Record<string, unknown>)),
    investmentTransactions: investmentTxnRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    holdings: holdingsRows.map((row) => serializeRow(row as Record<string, unknown>)),
    merchantCategoryRules: rules.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    budgets: budgetRows.map((row) => serializeRow(row as Record<string, unknown>)),
    savingsGoals: goalRows.map((row) => serializeRow(row as Record<string, unknown>)),
    recurringSeries: recurringRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    fireProfile: fireRow[0]
      ? serializeRow(fireRow[0] as Record<string, unknown>)
      : null,
    netWorthSnapshots: netWorthRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    wellnessScores: wellnessRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    spendingDna: dnaRow[0]
      ? serializeRow(dnaRow[0] as Record<string, unknown>)
      : null,
    spendingPatterns: patternRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    transactionReasons: reasonRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    challenges: challengeRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    habitStreaks: streakRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    lifestyleHabits: habitRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    inflationProfile: inflationRow[0]
      ? serializeRow(inflationRow[0] as Record<string, unknown>)
      : null,
    inflationCategories: inflationCatRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    resilienceProfile: resilienceRow[0]
      ? serializeRow(resilienceRow[0] as Record<string, unknown>)
      : null,
    resilienceScenarios: scenarioRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    coachInsights: coachRows.map((row) => serializeRow(row as Record<string, unknown>)),
    wrappedSummaries: wrappedRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    households: ownedHouseholds.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    householdMembers: memberRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    householdAccountAssignments: assignmentRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    householdInvitations: invitationRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    importBatches: batchRows.map((row) => serializeRow(row as Record<string, unknown>)),
    importFiles: fileRows.map((row) => serializeRow(row as Record<string, unknown>)),
    consentRecords: consentRows.map((row) =>
      serializeRow(row as Record<string, unknown>),
    ),
    auditEvents: auditRows.map((row) => {
      const serialized = serializeRow(row as Record<string, unknown>);
      return {
        ...serialized,
        createdAt: toIso(serialized.createdAt as Date | string | null),
      };
    }),
  };

  assertExportHasNoSecrets(payload);

  return payload;
}
