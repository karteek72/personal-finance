import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  householdAccountAssignments,
  householdMembers,
  households,
  transactions,
} from "../db/schema.js";

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

export async function getHouseholdForUser(userId: string) {
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

export async function getHouseholdDetails(userId: string) {
  const household = await getHouseholdForUser(userId);
  const db = getDb();

  const members = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.householdId, household.id))
    .orderBy(householdMembers.createdAt);

  const assignments = await db
    .select()
    .from(householdAccountAssignments)
    .where(eq(householdAccountAssignments.householdId, household.id));

  const assignmentByAccount = new Map(
    assignments.map((row) => [row.accountId, row.memberId]),
  );

  const accountRows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
    .orderBy(accounts.name);

  const memberById = new Map(members.map((member) => [member.id, member]));

  return {
    household: {
      id: household.id,
      name: household.name,
      createdAt: household.createdAt.toISOString(),
    },
    members: members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      role: member.role as HouseholdMemberRole,
      avatarColor: member.avatarColor,
      userId: member.userId,
      createdAt: member.createdAt.toISOString(),
    })),
    accounts: accountRows.map((account) => {
      const memberId = assignmentByAccount.get(account.id) ?? null;
      const member = memberId ? memberById.get(memberId) : undefined;
      return {
        accountId: account.id,
        name: account.name,
        mask: account.mask,
        institutionName: account.institutionName,
        balanceCurrent: account.balanceCurrent ?? "0.00",
        memberId,
        memberName: member?.displayName ?? null,
        memberColor: member?.avatarColor ?? null,
      };
    }),
  };
}

export async function updateHouseholdName(userId: string, name: string) {
  const household = await getHouseholdForUser(userId);
  const db = getDb();
  const [updated] = await db
    .update(households)
    .set({ name })
    .where(eq(households.id, household.id))
    .returning();
  return updated!;
}

export async function createHouseholdMember(
  userId: string,
  input: { displayName: string; role: HouseholdMemberRole },
) {
  const household = await getHouseholdForUser(userId);
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
  const household = await getHouseholdForUser(userId);
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
  const household = await getHouseholdForUser(userId);
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
  const household = await getHouseholdForUser(userId);
  const db = getDb();

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!account) {
    return null;
  }

  const [member] = await db
    .select({ id: householdMembers.id })
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

  await db
    .insert(householdAccountAssignments)
    .values({
      accountId,
      memberId,
      householdId: household.id,
    })
    .onConflictDoUpdate({
      target: householdAccountAssignments.accountId,
      set: { memberId, householdId: household.id },
    });

  return { accountId, memberId };
}

/** Assign accounts with no household member to the owner (e.g. after Plaid link). */
export async function ensureAccountsAssignedToOwner(
  userId: string,
  accountIds: string[],
): Promise<void> {
  if (accountIds.length === 0) {
    return;
  }

  const household = await getHouseholdForUser(userId);
  const db = getDb();

  const [owner] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, household.id),
        eq(householdMembers.role, "owner"),
      ),
    )
    .limit(1);

  if (!owner) {
    return;
  }

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
      memberId: owner.id,
      householdId: household.id,
    })),
  );
}

export async function resolveScopedAccountIds(
  userId: string,
  scope?: "all" | "household" | "personal",
  memberId?: string,
): Promise<string[] | null> {
  if (memberId) {
    const db = getDb();
    const rows = await db
      .select({ accountId: householdAccountAssignments.accountId })
      .from(householdAccountAssignments)
      .innerJoin(
        householdMembers,
        eq(householdAccountAssignments.memberId, householdMembers.id),
      )
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(
        and(
          eq(households.ownerUserId, userId),
          eq(householdAccountAssignments.memberId, memberId),
        ),
      );
    return rows.map((row) => row.accountId);
  }

  if (scope === "household") {
    const db = getDb();
    const rows = await db
      .select({ accountId: householdAccountAssignments.accountId })
      .from(householdAccountAssignments)
      .innerJoin(households, eq(householdAccountAssignments.householdId, households.id))
      .where(eq(households.ownerUserId, userId));
    return rows.map((row) => row.accountId);
  }

  if (scope === "personal") {
    const household = await getHouseholdForUser(userId);
    const db = getDb();
    const [owner] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, household.id),
          eq(householdMembers.role, "owner"),
        ),
      )
      .limit(1);

    if (!owner) {
      return [];
    }

    const rows = await db
      .select({ accountId: householdAccountAssignments.accountId })
      .from(householdAccountAssignments)
      .where(eq(householdAccountAssignments.memberId, owner.id));

    return rows.map((row) => row.accountId);
  }

  const db = getDb();
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

  return rows.map((row) => row.id);
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
