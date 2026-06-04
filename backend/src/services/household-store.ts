import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";
import {
  accounts,
  householdAccountAssignments,
  householdMembers,
  households,
  transactions,
} from "../db/schema.js";
import { getActiveAccountIds } from "./active-account-scope.js";
import {
  type HouseholdContext,
  requireHouseholdOwner,
  resolveHouseholdContext,
} from "./household-access.js";
import { getPendingInvitationForMember } from "./household-invitations.js";

export type HouseholdMemberRole = "owner" | "partner" | "child" | "other";

const MEMBER_COLORS = [
  "#7c3aed",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#06b6d4",
] as const;

function yearToDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export async function bootstrapOwnerHousehold(userId: string) {
  const db = getDb();
  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.ownerUserId, userId))
    .limit(1);

  if (household) {
    return household;
  }

  const [created] = await db
    .insert(households)
    .values({
      name: "My Family",
      ownerUserId: userId,
    })
    .returning();

  const [ownerMember] = await db
    .insert(householdMembers)
    .values({
      householdId: created!.id,
      userId,
      displayName: "Me",
      role: "owner",
      avatarColor: MEMBER_COLORS[0],
    })
    .returning();

  const userAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

  if (userAccounts.length > 0 && ownerMember) {
    await db.insert(householdAccountAssignments).values(
      userAccounts.map((account) => ({
        accountId: account.id,
        memberId: ownerMember.id,
        householdId: created!.id,
      })),
    );
  }

  return created!;
}

/** @deprecated Use bootstrapOwnerHousehold — owner-only household creation */
export async function getHouseholdForUser(userId: string) {
  return bootstrapOwnerHousehold(userId);
}

export async function getHouseholdDetails(userId: string) {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const members = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.householdId, ctx.householdId))
    .orderBy(householdMembers.createdAt);

  const assignments = await db
    .select()
    .from(householdAccountAssignments)
    .where(eq(householdAccountAssignments.householdId, ctx.householdId));

  const assignmentByAccount = new Map(
    assignments.map((row) => [row.accountId, row.memberId]),
  );

  const accountRows = await db
    .select()
    .from(accounts)
    .where(
      and(inArray(accounts.userId, ctx.userIds), eq(accounts.isActive, true)),
    )
    .orderBy(accounts.name);

  const memberById = new Map(members.map((member) => [member.id, member]));

  const [householdRow] = await db
    .select()
    .from(households)
    .where(eq(households.id, ctx.householdId))
    .limit(1);

  const memberPayload = await Promise.all(
    members.map(async (member) => {
      const pendingInvite =
        ctx.role === "owner" && !member.userId && member.role !== "owner"
          ? await getPendingInvitationForMember(ctx.householdId, member.id)
          : null;
      return {
        id: member.id,
        displayName: member.displayName,
        role: member.role as HouseholdMemberRole,
        avatarColor: member.avatarColor,
        userId: member.userId,
        createdAt: member.createdAt.toISOString(),
        pendingInvite,
      };
    }),
  );

  return {
    accessRole: ctx.role,
    household: {
      id: ctx.householdId,
      name: ctx.householdName,
      createdAt: householdRow?.createdAt.toISOString() ?? new Date().toISOString(),
    },
    members: memberPayload,
    accounts: accountRows.map((account) => {
      const memberId = assignmentByAccount.get(account.id) ?? null;
      const member = memberId ? memberById.get(memberId) : undefined;
      const ownerUserId = account.userId;
      return {
        accountId: account.id,
        name: account.name,
        mask: account.mask,
        institutionName: account.institutionName,
        balanceCurrent: account.balanceCurrent ?? "0.00",
        memberId,
        memberName: member?.displayName ?? null,
        memberColor: member?.avatarColor ?? null,
        ownedByCurrentUser: ownerUserId === userId,
        ownerUserId,
      };
    }),
  };
}

export async function updateHouseholdName(userId: string, name: string) {
  const ctx = await resolveHouseholdContext(userId);
  requireHouseholdOwner(ctx);
  const db = getDb();
  const [updated] = await db
    .update(households)
    .set({ name })
    .where(eq(households.id, ctx.householdId))
    .returning();
  return updated!;
}

export async function createHouseholdMember(
  userId: string,
  input: { displayName: string; role: HouseholdMemberRole },
) {
  const ctx = await resolveHouseholdContext(userId);
  requireHouseholdOwner(ctx);
  const household = { id: ctx.householdId };
  const db = getDb();

  const existing = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, household.id));

  const color = MEMBER_COLORS[existing.length % MEMBER_COLORS.length];

  const [member] = await db
    .insert(householdMembers)
    .values({
      householdId: household.id,
      displayName: input.displayName.trim(),
      role: input.role,
      avatarColor: color,
    })
    .returning();

  return {
    id: member!.id,
    displayName: member!.displayName,
    role: member!.role as HouseholdMemberRole,
    avatarColor: member!.avatarColor,
    userId: member!.userId,
    createdAt: member!.createdAt.toISOString(),
  };
}

export async function updateHouseholdMember(
  userId: string,
  memberId: string,
  input: { displayName?: string; role?: HouseholdMemberRole },
) {
  const ctx = await resolveHouseholdContext(userId);
  requireHouseholdOwner(ctx);
  const household = { id: ctx.householdId };
  const db = getDb();

  const [member] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(householdMembers.householdId, household.id),
      ),
    )
    .limit(1);

  if (!member) {
    return null;
  }

  if (member.role === "owner" && input.role && input.role !== "owner") {
    return null;
  }

  const [updated] = await db
    .update(householdMembers)
    .set({
      displayName: input.displayName?.trim() ?? member.displayName,
      role: input.role ?? member.role,
    })
    .where(eq(householdMembers.id, memberId))
    .returning();

  return {
    id: updated!.id,
    displayName: updated!.displayName,
    role: updated!.role as HouseholdMemberRole,
    avatarColor: updated!.avatarColor,
    userId: updated!.userId,
    createdAt: updated!.createdAt.toISOString(),
  };
}

export async function deleteHouseholdMember(userId: string, memberId: string) {
  const ctx = await resolveHouseholdContext(userId);
  requireHouseholdOwner(ctx);
  const household = { id: ctx.householdId };
  const db = getDb();

  const [member] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(householdMembers.householdId, household.id),
      ),
    )
    .limit(1);

  if (!member || member.role === "owner") {
    return false;
  }

  await db
    .delete(householdMembers)
    .where(eq(householdMembers.id, memberId));
  return true;
}

export async function assignAccountToMember(
  userId: string,
  accountId: string,
  memberId: string,
) {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const [account] = await db
    .select({ id: accounts.id, userId: accounts.userId })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        inArray(accounts.userId, ctx.userIds),
      ),
    )
    .limit(1);

  if (!account) {
    return null;
  }

  if (ctx.role === "member" && account.userId !== ctx.userId) {
    return null;
  }

  const [member] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(householdMembers.householdId, ctx.householdId),
      ),
    )
    .limit(1);

  if (!member) {
    return null;
  }

  await db
    .insert(householdAccountAssignments)
    .values({
      accountId,
      memberId,
      householdId: ctx.householdId,
    })
    .onConflictDoUpdate({
      target: householdAccountAssignments.accountId,
      set: { memberId, householdId: ctx.householdId },
    });

  return { accountId, memberId };
}

/** Assign new Plaid accounts to the member row linked to this user. */
export async function ensureAccountsAssignedToOwner(
  userId: string,
  accountIds: string[],
): Promise<void> {
  if (accountIds.length === 0) {
    return;
  }

  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const ownedAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)),
    );

  if (ownedAccounts.length === 0) {
    return;
  }

  const existing = await db
    .select({ accountId: householdAccountAssignments.accountId })
    .from(householdAccountAssignments)
    .where(
      inArray(
        householdAccountAssignments.accountId,
        ownedAccounts.map((row) => row.id),
      ),
    );

  const assigned = new Set(existing.map((row) => row.accountId));
  const unassigned = ownedAccounts
    .map((row) => row.id)
    .filter((id) => !assigned.has(id));

  if (unassigned.length === 0) {
    return;
  }

  await db.insert(householdAccountAssignments).values(
    unassigned.map((accountId) => ({
      accountId,
      memberId: ctx.memberId,
      householdId: ctx.householdId,
    })),
  );
}

export async function resolveScopedAccountIds(
  userId: string,
  scope?: "all" | "household" | "personal",
  memberId?: string,
): Promise<string[] | null> {
  const ctx = await resolveHouseholdContext(userId);
  return resolveScopedAccountIdsForContext(ctx, scope, memberId);
}

function intersectActiveIds(
  candidateIds: string[],
  activeSet: Set<string>,
): string[] {
  return candidateIds.filter((id) => activeSet.has(id));
}

export async function resolveScopedAccountIdsForContext(
  ctx: HouseholdContext,
  scope?: "all" | "household" | "personal",
  memberId?: string,
): Promise<string[] | null> {
  const db = getDb();
  const activeSet = new Set(await getActiveAccountIds(ctx.userIds));

  if (memberId) {
    const rows = await db
      .select({ accountId: householdAccountAssignments.accountId })
      .from(householdAccountAssignments)
      .where(
        and(
          eq(householdAccountAssignments.householdId, ctx.householdId),
          eq(householdAccountAssignments.memberId, memberId),
        ),
      );
    return intersectActiveIds(
      rows.map((row) => row.accountId),
      activeSet,
    );
  }

  if (scope === "household") {
    const rows = await db
      .select({ accountId: householdAccountAssignments.accountId })
      .from(householdAccountAssignments)
      .where(eq(householdAccountAssignments.householdId, ctx.householdId));
    return intersectActiveIds(
      rows.map((row) => row.accountId),
      activeSet,
    );
  }

  if (scope === "personal") {
    const rows = await db
      .select({ accountId: householdAccountAssignments.accountId })
      .from(householdAccountAssignments)
      .where(eq(householdAccountAssignments.memberId, ctx.memberId));
    return intersectActiveIds(
      rows.map((row) => row.accountId),
      activeSet,
    );
  }

  return [...activeSet];
}

export async function getHouseholdInsights(userId: string) {
  const { from, to } = yearToDateRange();
  const details = await getHouseholdDetails(userId);
  const db = getDb();

  const memberStats = await Promise.all(
    details.members.map(async (member) => {
      const accountIds = details.accounts
        .filter((account) => account.memberId === member.id)
        .map((account) => account.accountId);

      if (accountIds.length === 0) {
        return {
          memberId: member.id,
          displayName: member.displayName,
          role: member.role,
          avatarColor: member.avatarColor,
          accountCount: 0,
          totalSpent: "0.00",
          totalIncome: "0.00",
          topCategory: { name: "None", amount: "0.00" },
        };
      }

      const [spentRow] = await db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::text AS total
        FROM transactions
        WHERE account_id IN (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})
          AND transaction_type = 'expense'
          AND NOT is_transfer
          AND category != ${INTERNAL_TRANSFER_CATEGORY}
          AND date >= ${from}
          AND date <= ${to}
      `);

      const [incomeRow] = await db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
        FROM transactions
        WHERE account_id IN (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})
          AND transaction_type = 'income'
          AND NOT is_transfer
          AND date >= ${from}
          AND date <= ${to}
      `);

      const topCategoryRows = await db.execute<{ name: string; amount: string }>(sql`
        SELECT category AS name, SUM(amount::numeric)::text AS amount
        FROM transactions
        WHERE account_id IN (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})
          AND transaction_type = 'expense'
          AND NOT is_transfer
          AND category != ${INTERNAL_TRANSFER_CATEGORY}
          AND date >= ${from}
          AND date <= ${to}
        GROUP BY category
        ORDER BY SUM(amount::numeric) DESC
        LIMIT 1
      `);

      return {
        memberId: member.id,
        displayName: member.displayName,
        role: member.role,
        avatarColor: member.avatarColor,
        accountCount: accountIds.length,
        totalSpent: spentRow?.total ?? "0.00",
        totalIncome: incomeRow?.total ?? "0.00",
        topCategory: topCategoryRows[0] ?? { name: "None", amount: "0.00" },
      };
    }),
  );

  const unassignedAccounts = details.accounts.filter(
    (account) => !account.memberId,
  );

  const householdAccountIds = details.accounts
    .filter((account) => account.memberId)
    .map((account) => account.accountId);

  let householdTotals = { expenses: "0.00", income: "0.00", net: "0.00" };

  if (householdAccountIds.length > 0) {
    const [spentRow] = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::text AS total
      FROM transactions
      WHERE account_id IN (${sql.join(householdAccountIds.map((id) => sql`${id}`), sql`, `)})
        AND transaction_type = 'expense'
        AND NOT is_transfer
        AND date >= ${from}
        AND date <= ${to}
    `);

    const [incomeRow] = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::text AS total
      FROM transactions
      WHERE account_id IN (${sql.join(householdAccountIds.map((id) => sql`${id}`), sql`, `)})
        AND transaction_type = 'income'
        AND NOT is_transfer
        AND date >= ${from}
        AND date <= ${to}
    `);

    const spent = Number.parseFloat(spentRow?.total ?? "0");
    const income = Number.parseFloat(incomeRow?.total ?? "0");
    householdTotals = {
      expenses: spent.toFixed(2),
      income: income.toFixed(2),
      net: (income - spent).toFixed(2),
    };
  }

  return {
    members: memberStats,
    unassignedAccounts,
    householdTotals,
    period: { from, to },
  };
}

export async function getMemberMapForAccounts(accountIds: string[]) {
  if (accountIds.length === 0) {
    return new Map<string, { memberId: string; memberName: string; memberColor: string }>();
  }

  const db = getDb();
  const rows = await db
    .select({
      accountId: householdAccountAssignments.accountId,
      memberId: householdMembers.id,
      memberName: householdMembers.displayName,
      memberColor: householdMembers.avatarColor,
    })
    .from(householdAccountAssignments)
    .innerJoin(
      householdMembers,
      eq(householdAccountAssignments.memberId, householdMembers.id),
    )
    .where(inArray(householdAccountAssignments.accountId, accountIds));

  return new Map(
    rows.map((row) => [
      row.accountId,
      {
        memberId: row.memberId,
        memberName: row.memberName,
        memberColor: row.memberColor,
      },
    ]),
  );
}
