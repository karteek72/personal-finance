import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  householdMembers,
  households,
} from "../db/schema.js";
import { AppError } from "../lib/errors.js";

export type HouseholdAccessRole = "owner" | "member";

export interface HouseholdContext {
  householdId: string;
  householdName: string;
  role: HouseholdAccessRole;
  /** Logged-in user id */
  userId: string;
  ownerUserId: string;
  /** Member row for the logged-in user (owner or linked partner) */
  memberId: string;
  /** Owner plus every linked member with a user account */
  userIds: string[];
}

async function loadHouseholdUserIds(
  householdId: string,
  ownerUserId: string,
): Promise<string[]> {
  const db = getDb();
  const members = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        isNotNull(householdMembers.userId),
      ),
    );

  const ids = new Set<string>([ownerUserId]);
  for (const row of members) {
    if (row.userId) {
      ids.add(row.userId);
    }
  }
  return [...ids];
}

export async function resolveHouseholdContext(
  userId: string,
): Promise<HouseholdContext> {
  const db = getDb();

  const [owned] = await db
    .select()
    .from(households)
    .where(eq(households.ownerUserId, userId))
    .limit(1);

  if (owned) {
    const [ownerMember] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, owned.id),
          eq(householdMembers.role, "owner"),
        ),
      )
      .limit(1);

    if (!ownerMember) {
      throw AppError.internal();
    }

    const userIds = await loadHouseholdUserIds(owned.id, userId);
    return {
      householdId: owned.id,
      householdName: owned.name,
      role: "owner",
      userId,
      ownerUserId: userId,
      memberId: ownerMember.id,
      userIds,
    };
  }

  const [membership] = await db
    .select({
      member: householdMembers,
      household: households,
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId))
    .limit(1);

  if (membership) {
    const userIds = await loadHouseholdUserIds(
      membership.household.id,
      membership.household.ownerUserId,
    );
    return {
      householdId: membership.household.id,
      householdName: membership.household.name,
      role: "member",
      userId,
      ownerUserId: membership.household.ownerUserId,
      memberId: membership.member.id,
      userIds,
    };
  }

  const { bootstrapOwnerHousehold } = await import("./household-store.js");
  const household = await bootstrapOwnerHousehold(userId);
  const userIds = await loadHouseholdUserIds(household.id, userId);

  const [ownerMember] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, household.id),
        eq(householdMembers.role, "owner"),
      ),
    )
    .limit(1);

  if (!ownerMember) {
    throw AppError.internal();
  }

  return {
    householdId: household.id,
    householdName: household.name,
    role: "owner",
    userId,
    ownerUserId: userId,
    memberId: ownerMember.id,
    userIds,
  };
}

export function requireHouseholdOwner(ctx: HouseholdContext): void {
  if (ctx.role !== "owner") {
    throw AppError.forbidden("Only the household owner can perform this action");
  }
}

export async function accountVisibleInHousehold(
  ctx: HouseholdContext,
  accountId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        inArray(accounts.userId, ctx.userIds),
        eq(accounts.isActive, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}
