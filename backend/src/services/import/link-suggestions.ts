import { and, eq } from "drizzle-orm";
import type { getDb } from "../../db/client.js";
import { accounts } from "../../db/schema.js";

export interface AccountLinkSuggestion {
  importAccountId: string;
  importAccountName: string;
  importInstitution: string;
  importMask: string;
  plaidAccountId: string;
  plaidAccountName: string;
  plaidInstitution: string;
  plaidMask: string;
  matchScore: number;
  reason: string;
}

function normalizeInstitution(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function getAccountLinkSuggestions(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<AccountLinkSuggestion[]> {
  const userAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      mask: accounts.mask,
      type: accounts.type,
      institutionName: accounts.institutionName,
      source: accounts.source,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

  const importAccounts = userAccounts.filter((a) => a.source === "import");
  const plaidAccounts = userAccounts.filter((a) => a.source === "plaid");

  const suggestions: AccountLinkSuggestion[] = [];

  for (const imp of importAccounts) {
    for (const plaid of plaidAccounts) {
      if (imp.type !== plaid.type) continue;

      let score = 0;
      const reasons: string[] = [];

      if (imp.mask === plaid.mask && imp.mask.length >= 4) {
        score += 50;
        reasons.push("same last-4");
      }

      const impInst = normalizeInstitution(imp.institutionName);
      const plaidInst = normalizeInstitution(plaid.institutionName);
      if (impInst === plaidInst) {
        score += 40;
        reasons.push("same institution");
      } else if (impInst.includes(plaidInst) || plaidInst.includes(impInst)) {
        score += 20;
        reasons.push("similar institution name");
      }

      if (score >= 50) {
        suggestions.push({
          importAccountId: imp.id,
          importAccountName: imp.name,
          importInstitution: imp.institutionName,
          importMask: imp.mask,
          plaidAccountId: plaid.id,
          plaidAccountName: plaid.name,
          plaidInstitution: plaid.institutionName,
          plaidMask: plaid.mask,
          matchScore: score,
          reason: reasons.join(", "),
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.matchScore - a.matchScore);
}

export async function mergeImportAccountIntoPlaid(
  db: ReturnType<typeof getDb>,
  userId: string,
  importAccountId: string,
  plaidAccountId: string,
): Promise<void> {
  const [importAcct] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, importAccountId),
        eq(accounts.userId, userId),
        eq(accounts.source, "import"),
      ),
    )
    .limit(1);

  const [plaidAcct] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, plaidAccountId),
        eq(accounts.userId, userId),
        eq(accounts.source, "plaid"),
      ),
    )
    .limit(1);

  if (!importAcct || !plaidAcct) {
    throw new Error("Import or Plaid account not found for merge.");
  }

  if (importAcct.type !== plaidAcct.type) {
    throw new Error("Cannot merge accounts of different types.");
  }

  await db
    .update(accounts)
    .set({
      isActive: false,
      status: "merged",
      officialName: `${importAcct.name} (merged into ${plaidAcct.name})`,
    })
    .where(eq(accounts.id, importAccountId));
}
