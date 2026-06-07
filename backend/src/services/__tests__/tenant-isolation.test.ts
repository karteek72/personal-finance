import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq } from "drizzle-orm";

import { getDb } from "../../db/client.js";
import { accounts, transactions, users } from "../../db/schema.js";
import { resolveHouseholdContext } from "../household-access.js";
import { bootstrapOwnerHousehold } from "../household-store.js";
import { getDataQuality } from "../data-quality.js";
import { getSummary, getCategories, getMoneyFlow, getTrends } from "../transaction-store.js";
import { getWellness } from "../insights-store.js";
import { getPatterns } from "../insights-store.js";
import { listMerchants } from "../analytics-merchants.js";
import { parseListQuery } from "../../lib/list-query.js";
import { MERCHANT_SORTABLE } from "../analytics-merchants.js";

const RUN_INTEGRATION =
  process.env.RUN_TENANT_TESTS === "1" || process.env.CI === "true";

const MARKER_B = `TENANT_LEAK_MARKER_${randomUUID()}`;

async function seedTenantFixture(): Promise<{
  userAId: string;
  userBId: string;
  cleanup: () => Promise<void>;
}> {
  const db = getDb();
  const suffix = randomUUID().slice(0, 8);
  const [userA] = await db
    .insert(users)
    .values({ email: `tenant-a-${suffix}@test.local` })
    .returning({ id: users.id });
  const [userB] = await db
    .insert(users)
    .values({ email: `tenant-b-${suffix}@test.local` })
    .returning({ id: users.id });

  await bootstrapOwnerHousehold(userA!.id);
  await bootstrapOwnerHousehold(userB!.id);

  const [acctA] = await db
    .insert(accounts)
    .values({
      userId: userA!.id,
      name: "A Checking",
      type: "depository",
      mask: "1111",
      institutionName: "Bank A",
      source: "import",
      balanceCurrent: "1000.00",
      isActive: true,
    })
    .returning({ id: accounts.id });

  const [acctB] = await db
    .insert(accounts)
    .values({
      userId: userB!.id,
      name: "B Checking",
      type: "depository",
      mask: "2222",
      institutionName: "Bank B",
      source: "import",
      balanceCurrent: "5000.00",
      isActive: true,
    })
    .returning({ id: accounts.id });

  await db.insert(transactions).values([
    {
      userId: userA!.id,
      accountId: acctA!.id,
      externalId: `ext-a-${suffix}`,
      date: "2025-06-01",
      name: "User A Grocery",
      amount: "42.00",
      transactionType: "expense",
      source: "import",
    },
    {
      userId: userB!.id,
      accountId: acctB!.id,
      externalId: `ext-b-${suffix}`,
      date: "2025-06-01",
      name: MARKER_B,
      amount: "999.00",
      transactionType: "expense",
      source: "import",
    },
  ]);

  const cleanup = async (): Promise<void> => {
    await db.delete(users).where(eq(users.id, userA!.id));
    await db.delete(users).where(eq(users.id, userB!.id));
  };

  return { userAId: userA!.id, userBId: userB!.id, cleanup };
}

function assertNoLeak(payload: unknown, marker: string, label: string): void {
  const json = JSON.stringify(payload);
  assert.equal(
    json.includes(marker),
    false,
    `${label} leaked data from household B`,
  );
}

test(
  "tenant isolation — read endpoints return only caller household data",
  { skip: !RUN_INTEGRATION },
  async () => {
    const { userAId, cleanup } = await seedTenantFixture();
    try {
      const ctx = await resolveHouseholdContext(userAId);
      const from = "2025-01-01";
      const to = "2025-12-31";
      const merchantQuery = parseListQuery(
        {},
        { sortable: MERCHANT_SORTABLE, defaultSort: "total", defaultDir: "desc" },
      );

      const responses: Array<{ label: string; data: unknown }> = [
        { label: "summary", data: await getSummary(ctx.userIds, from, to) },
        { label: "categories", data: await getCategories(ctx.userIds, from, to) },
        {
          label: "moneyFlow",
          data: await getMoneyFlow(
            ctx.userIds,
            parseListQuery({}, { sortable: ["label", "amount"], defaultSort: "amount", defaultDir: "desc" }),
          ),
        },
        { label: "trends", data: await getTrends(ctx.userIds, from, to) },
        { label: "wellness", data: await getWellness(userAId) },
        {
          label: "patterns",
          data: await getPatterns(
            userAId,
            parseListQuery({}, { sortable: ["label", "value"], defaultSort: "value", defaultDir: "desc" }),
          ),
        },
        { label: "merchants", data: await listMerchants(userAId, merchantQuery) },
        { label: "dataQuality", data: await getDataQuality(userAId) },
      ];

      for (const { label, data } of responses) {
        assertNoLeak(data, MARKER_B, label);
      }
    } finally {
      await cleanup();
    }
  },
);
