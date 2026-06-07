import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Env } from "../config/env.js";
import { getDb } from "../db/client.js";
import {
  householdInvitations,
  householdMembers,
  households,
  users,
} from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import { getUserById } from "./auth/user-auth.js";
import {
  requireHouseholdOwner,
  resolveHouseholdContext,
} from "./household-access.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function inviteBaseUrl(env: Env): string {
  return env.UI_APP_URL.replace(/\/$/, "");
}

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createHouseholdInvitation(
  ownerUserId: string,
  memberId: string,
  email: string,
  env: Env,
): Promise<{
  invitationId: string;
  inviteUrl: string;
  expiresAt: string;
  email: string;
}> {
  const ctx = await resolveHouseholdContext(ownerUserId);
  requireHouseholdOwner(ctx);

  const db = getDb();
  const normalized = normalizeEmail(email);

  const [member] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(householdMembers.householdId, ctx.householdId),
      ),
    )
    .limit(1);

  if (!member) {
    throw AppError.notFound("Member not found");
  }

  if (member.role === "owner") {
    throw AppError.validation("Cannot invite the household owner");
  }

  if (member.userId) {
    throw AppError.conflict("This member already has a linked account");
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existingUser) {
    const [alreadyMember] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(eq(householdMembers.userId, existingUser.id))
      .limit(1);
    if (alreadyMember) {
      throw AppError.conflict("That email already belongs to a household member");
    }
  }

  await db
    .delete(householdInvitations)
    .where(
      and(
        eq(householdInvitations.memberId, memberId),
        isNull(householdInvitations.acceptedAt),
      ),
    );

  const token = createToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const [invitation] = await db
    .insert(householdInvitations)
    .values({
      householdId: ctx.householdId,
      memberId,
      email: normalized,
      token,
      invitedByUserId: ownerUserId,
      expiresAt,
    })
    .returning();

  const inviteUrl = `${inviteBaseUrl(env)}/accept-invite?token=${encodeURIComponent(token)}`;

  return {
    invitationId: invitation!.id,
    inviteUrl,
    expiresAt: expiresAt.toISOString(),
    email: normalized,
  };
}

export async function getInvitationPreview(token: string) {
  const db = getDb();
  const [row] = await db
    .select({
      invitation: householdInvitations,
      memberName: householdMembers.displayName,
      memberRole: householdMembers.role,
    })
    .from(householdInvitations)
    .innerJoin(
      householdMembers,
      eq(householdInvitations.memberId, householdMembers.id),
    )
    .where(eq(householdInvitations.token, token))
    .limit(1);

  if (!row) {
    return null;
  }

  const [household] = await db
    .select({ name: households.name })
    .from(households)
    .where(eq(households.id, row.invitation.householdId))
    .limit(1);

  const expired = row.invitation.expiresAt.getTime() < Date.now();
  const accepted = row.invitation.acceptedAt !== null;

  return {
    householdName: household?.name ?? "Family",
    memberName: row.memberName,
    memberRole: row.memberRole,
    email: row.invitation.email,
    expiresAt: row.invitation.expiresAt.toISOString(),
    status: accepted ? ("accepted" as const) : expired ? ("expired" as const) : ("pending" as const),
  };
}

export async function acceptHouseholdInvitation(
  userId: string,
  token: string,
): Promise<{
  householdId: string;
  householdName: string;
  memberId: string;
  memberDisplayName: string;
}> {
  const db = getDb();
  const user = await getUserById(userId);
  if (!user) {
    throw AppError.unauthenticated();
  }

  const [row] = await db
    .select({
      invitation: householdInvitations,
      member: householdMembers,
    })
    .from(householdInvitations)
    .innerJoin(
      householdMembers,
      eq(householdInvitations.memberId, householdMembers.id),
    )
    .where(eq(householdInvitations.token, token))
    .limit(1);

  if (!row) {
    throw AppError.notFound("Invitation not found");
  }

  if (row.invitation.acceptedAt) {
    throw AppError.conflict("Invitation already accepted");
  }

  if (row.invitation.expiresAt.getTime() < Date.now()) {
    throw AppError.validation("Invitation has expired");
  }

  if (normalizeEmail(user.email) !== row.invitation.email) {
    throw AppError.forbidden(
      "Sign in with the Google account that matches the invited email",
    );
  }

  const [existingMembership] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .limit(1);

  if (existingMembership) {
    throw AppError.conflict("You are already linked to a household");
  }

  const [ownedHousehold] = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.ownerUserId, userId))
    .limit(1);

  if (ownedHousehold) {
    throw AppError.conflict(
      "You already own a household. Use that account or a different Google login.",
    );
  }

  await db
    .update(householdMembers)
    .set({ userId })
    .where(eq(householdMembers.id, row.member.id));

  await db
    .update(householdInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(householdInvitations.id, row.invitation.id));

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, row.invitation.householdId))
    .limit(1);

  const { scheduleHouseholdRecompute } = await import("./household-recompute.js");
  scheduleHouseholdRecompute(userId);
  scheduleHouseholdRecompute(row.invitation.invitedByUserId);

  return {
    householdId: row.invitation.householdId,
    householdName: household?.name ?? "Family",
    memberId: row.member.id,
    memberDisplayName: row.member.displayName,
  };
}

export async function revokeHouseholdInvitation(
  ownerUserId: string,
  memberId: string,
): Promise<boolean> {
  const ctx = await resolveHouseholdContext(ownerUserId);
  requireHouseholdOwner(ctx);

  const db = getDb();
  const result = await db
    .delete(householdInvitations)
    .where(
      and(
        eq(householdInvitations.memberId, memberId),
        eq(householdInvitations.householdId, ctx.householdId),
        isNull(householdInvitations.acceptedAt),
      ),
    )
    .returning({ id: householdInvitations.id });

  return result.length > 0;
}

export async function getPendingInvitationForMember(
  householdId: string,
  memberId: string,
) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(householdInvitations)
    .where(
      and(
        eq(householdInvitations.memberId, memberId),
        eq(householdInvitations.householdId, householdId),
        isNull(householdInvitations.acceptedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const expired = row.expiresAt.getTime() < Date.now();
  return {
    id: row.id,
    email: row.email,
    expiresAt: row.expiresAt.toISOString(),
    status: expired ? ("expired" as const) : ("pending" as const),
  };
}
