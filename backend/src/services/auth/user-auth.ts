import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { users } from "../../db/schema.js";
import type { GoogleProfile } from "./google.js";

export type UserRecord = typeof users.$inferSelect;

export function serializeUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

export async function findOrCreateUserFromGoogle(
  profile: GoogleProfile,
): Promise<UserRecord> {
  const db = getDb();

  const [byGoogle] = await db
    .select()
    .from(users)
    .where(eq(users.googleSub, profile.sub))
    .limit(1);
  if (byGoogle) {
    if (profile.name && byGoogle.displayName !== profile.name) {
      const [updated] = await db
        .update(users)
        .set({ displayName: profile.name })
        .where(eq(users.id, byGoogle.id))
        .returning();
      return updated ?? byGoogle;
    }
    return byGoogle;
  }

  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (byEmail) {
    const [linked] = await db
      .update(users)
      .set({
        googleSub: profile.sub,
        displayName: profile.name ?? byEmail.displayName,
      })
      .where(eq(users.id, byEmail.id))
      .returning();
    return linked ?? byEmail;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: profile.email,
      googleSub: profile.sub,
      displayName: profile.name,
    })
    .returning();

  return created!;
}
