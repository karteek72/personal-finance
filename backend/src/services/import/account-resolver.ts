import { and, eq } from "drizzle-orm";
import type { getDb } from "../../db/client.js";
import { accounts } from "../../db/schema.js";
import type { ParsedAccountIdentity } from "./types.js";

export async function findMatchingImportAccount(
  db: ReturnType<typeof getDb>,
  userId: string,
  identity: ParsedAccountIdentity,
): Promise<string | null> {
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.mask, identity.mask),
        eq(accounts.type, identity.type),
        eq(accounts.institutionName, identity.institutionName),
      ),
    )
    .limit(1);

  return existing[0]?.id ?? null;
}

export async function resolveOrCreateImportAccount(
  db: ReturnType<typeof getDb>,
  userId: string,
  identity: ParsedAccountIdentity,
): Promise<string> {
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.mask, identity.mask),
        eq(accounts.type, identity.type),
        eq(accounts.institutionName, identity.institutionName),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  const displayName =
    identity.officialName ??
    `${identity.institutionName} ••${identity.mask}`;

  const [created] = await db
    .insert(accounts)
    .values({
      userId,
      name: displayName,
      officialName: identity.officialName ?? displayName,
      type: identity.type,
      subtype: identity.subtype,
      mask: identity.mask,
      institutionName: identity.institutionName,
      currencyCode: identity.currencyCode,
      source: "import",
      isActive: true,
      status: "active",
    })
    .returning({ id: accounts.id });

  if (!created) {
    throw new Error("Failed to create import account");
  }

  return created.id;
}
