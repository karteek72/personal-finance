import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";

export const DEV_USER_EMAIL = "personal@spendflow.local";

export async function getOrCreateDevUser() {
  const db = getDb();
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEV_USER_EMAIL))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email: DEV_USER_EMAIL, displayName: "Alex Rivera" })
      .returning();
  } else if (!user.displayName?.trim()) {
    [user] = await db
      .update(users)
      .set({ displayName: "Alex Rivera" })
      .where(eq(users.id, user.id))
      .returning();
  }

  return user!;
}
