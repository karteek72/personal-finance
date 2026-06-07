import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { deviceTokens } from "../db/schema.js";

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform = "ios",
): Promise<void> {
  const db = getDb();
  await db
    .insert(deviceTokens)
    .values({ userId, token, platform })
    .onConflictDoUpdate({
      target: [deviceTokens.userId, deviceTokens.token],
      set: { platform, updatedAt: new Date() },
    });
}

export async function deleteDeviceToken(
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(deviceTokens)
    .where(and(eq(deviceTokens.id, tokenId), eq(deviceTokens.userId, userId)))
    .returning({ id: deviceTokens.id });
  return rows.length > 0;
}

export async function listDeviceTokensForUser(userId: string): Promise<
  Array<{ id: string; token: string; platform: string }>
> {
  const db = getDb();
  return db
    .select({
      id: deviceTokens.id,
      token: deviceTokens.token,
      platform: deviceTokens.platform,
    })
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId));
}
