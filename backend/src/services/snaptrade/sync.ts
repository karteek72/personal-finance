import { and, eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import {
  accounts,
  holdings,
  investmentTransactions,
  securities,
  snaptradeConnections,
} from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import { formatMoneyAmount } from "../../lib/money.js";
import { createLogger } from "../../lib/logger.js";
import { ensureAccountsAssignedToOwner } from "../household-store.js";
import { refreshFireProfile } from "../investment-analytics.js";
import { getSnaptradeClient, resolveSnaptradeRedirectUri } from "./client.js";
import { getSnaptradeCredentials } from "./user-store.js";

const log = createLogger("snaptrade.sync");

export interface SnaptradeSyncResult {
  connectionsSynced: number;
  accountsSynced: number;
  holdingsUpdated: number;
  activitiesAdded: number;
}

interface SnaptradeBrokerageAccount {
  id?: string;
  number?: string;
  name?: string;
  balance?: { total?: { amount?: number | string | null } | null } | null;
  sync_status?: { holdings?: { initial_sync_completed?: boolean } | null } | null;
  brokerage_authorization?: string;
  institution_name?: string;
}

interface SnaptradePositionInstrument {
  symbol?: string | null;
  description?: string | null;
  currency?: { code?: string } | null;
}

interface SnaptradePosition {
  symbol?: SnaptradePositionInstrument | null;
  units?: number | string | null;
  price?: number | string | null;
  average_purchase_price?: number | string | null;
  open_pnl?: number | string | null;
}

interface SnaptradeActivity {
  id?: string;
  trade_date?: string | null;
  settlement_date?: string | null;
  type?: string | null;
  symbol?: SnaptradePositionInstrument | null;
  description?: string | null;
  amount?: number | string | null;
  fee?: number | string | null;
  units?: number | string | null;
  price?: number | string | null;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function parseMoney(value: number | string | null | undefined): string {
  if (value == null || value === "") return "0.00";
  return formatMoneyAmount(value);
}

function mapActivityType(
  raw: string | null | undefined,
): "buy" | "sell" | "dividend" | "contribution" | "fee" {
  const t = (raw ?? "").toUpperCase();
  if (t === "BUY" || t === "REI") return "buy";
  if (t === "SELL") return "sell";
  if (t.includes("DIVIDEND")) return "dividend";
  if (t === "CONTRIBUTION" || t === "WITHDRAWAL" || t === "TRANSFER") {
    return "contribution";
  }
  if (t === "FEE" || t === "TAX") return "fee";
  return "buy";
}

async function upsertSecurity(
  db: ReturnType<typeof getDb>,
  ticker: string,
  name: string,
  currentPrice?: string,
): Promise<string> {
  const normalized = ticker.toUpperCase().slice(0, 32);
  const price =
    currentPrice && Number.parseFloat(currentPrice) > 0
      ? formatMoneyAmount(currentPrice)
      : undefined;

  const [existing] = await db
    .select({ id: securities.id })
    .from(securities)
    .where(eq(securities.ticker, normalized))
    .limit(1);

  if (existing) {
    if (price) {
      await db
        .update(securities)
        .set({ currentPrice: price, asOf: new Date() })
        .where(eq(securities.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(securities)
    .values({
      ticker: normalized,
      name: name.slice(0, 200) || normalized,
      assetType: "equity",
      currentPrice: price ?? "0",
    })
    .returning();

  return created!.id;
}

async function fetchAccountActivities(
  client: ReturnType<typeof getSnaptradeClient>,
  creds: { snaptradeUserId: string; userSecret: string },
  snaptradeAccountId: string,
): Promise<SnaptradeActivity[]> {
  const collected: SnaptradeActivity[] = [];
  const windows = [
    { start: daysAgoIso(730), end: daysAgoIso(365) },
    { start: daysAgoIso(365), end: daysAgoIso(0) },
  ];

  for (const window of windows) {
    const activitiesResponse =
      await client.accountInformation.getAccountActivities({
        accountId: snaptradeAccountId,
        userId: creds.snaptradeUserId,
        userSecret: creds.userSecret,
        startDate: window.start,
        endDate: window.end,
        limit: 1000,
      });

    const batch = (activitiesResponse.data?.data ??
      activitiesResponse.data ??
      []) as SnaptradeActivity[];
    collected.push(...batch);
  }

  const seen = new Set<string>();
  return collected.filter((activity) => {
    const id = activity.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function createSnaptradePortalUrl(
  userId: string,
  env: Env,
  options?: { broker?: string; reconnectAuthorizationId?: string },
): Promise<{ redirectUri: string }> {
  const creds = await getSnaptradeCredentials(userId, env);
  const client = getSnaptradeClient(env);
  const customRedirect = resolveSnaptradeRedirectUri(env);

  const response = await client.authentication.loginSnapTradeUser({
    userId: creds.snaptradeUserId,
    userSecret: creds.userSecret,
    broker: options?.broker,
    immediateRedirect: true,
    customRedirect,
    reconnect: options?.reconnectAuthorizationId,
    connectionType: "read",
    connectionPortalVersion: "v4",
  });

  const data = response.data;
  const redirectUri =
    typeof data === "string"
      ? data
      : typeof data === "object" &&
          data !== null &&
          "redirectURI" in data &&
          typeof (data as { redirectURI: unknown }).redirectURI === "string"
        ? (data as { redirectURI: string }).redirectURI
        : undefined;

  if (!redirectUri) {
    throw AppError.snaptradeError("SnapTrade did not return a portal URL");
  }

  return { redirectUri };
}

export async function syncSnaptradeForUser(
  userId: string,
  env: Env,
): Promise<SnaptradeSyncResult> {
  const db = getDb();
  const creds = await getSnaptradeCredentials(userId, env);
  const client = getSnaptradeClient(env);

  const authResponse = await client.connections.listBrokerageAuthorizations({
    userId: creds.snaptradeUserId,
    userSecret: creds.userSecret,
  });

  const authorizations = authResponse.data ?? [];
  let connectionsSynced = 0;
  let accountsSynced = 0;
  let holdingsUpdated = 0;
  let activitiesAdded = 0;

  for (const auth of authorizations) {
    const authorizationId = auth.id;
    if (!authorizationId) continue;

    const brokerageName =
      auth.brokerage?.name ?? auth.name ?? "Brokerage";

    const [existingConn] = await db
      .select({ id: snaptradeConnections.id })
      .from(snaptradeConnections)
      .where(eq(snaptradeConnections.authorizationId, authorizationId))
      .limit(1);

    let connectionDbId: string;
    if (existingConn) {
      connectionDbId = existingConn.id;
      await db
        .update(snaptradeConnections)
        .set({ brokerageName, status: "active", lastSyncedAt: new Date() })
        .where(eq(snaptradeConnections.id, connectionDbId));
    } else {
      const [created] = await db
        .insert(snaptradeConnections)
        .values({
          userId,
          authorizationId,
          brokerageName,
          status: "active",
          lastSyncedAt: new Date(),
        })
        .returning();
      connectionDbId = created!.id;
    }
    connectionsSynced += 1;

    const accountsResponse =
      await client.connections.listBrokerageAuthorizationAccounts({
        authorizationId,
        userId: creds.snaptradeUserId,
        userSecret: creds.userSecret,
      });

    const brokerageAccounts = (accountsResponse.data ??
      []) as SnaptradeBrokerageAccount[];

    const accountIds: string[] = [];

    for (const acct of brokerageAccounts) {
      const snaptradeAccountId = acct.id;
      if (!snaptradeAccountId) continue;

      const mask =
        (acct.number ?? "").replace(/\D/g, "").slice(-4) || "0000";
      const balanceTotal = acct.balance?.total?.amount;
      const balanceCurrent = parseMoney(balanceTotal);
      const institutionName = acct.institution_name ?? brokerageName;

      const [existingAcct] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.snaptradeAccountId, snaptradeAccountId))
        .limit(1);

      let accountDbId: string;
      if (existingAcct) {
        accountDbId = existingAcct.id;
        await db
          .update(accounts)
          .set({
            name: acct.name ?? "Investment account",
            mask,
            institutionName,
            balanceCurrent,
            lastSyncedAt: new Date(),
            status: "active",
          })
          .where(eq(accounts.id, accountDbId));
      } else {
        const [inserted] = await db
          .insert(accounts)
          .values({
            userId,
            snaptradeConnectionId: connectionDbId,
            snaptradeAccountId,
            name: acct.name ?? "Investment account",
            type: "investment",
            subtype: "brokerage",
            mask,
            institutionName,
            currencyCode: "USD",
            source: "snaptrade",
            balanceCurrent,
            balanceAvailable: null,
            lastSyncedAt: new Date(),
            status: "active",
          })
          .returning();
        accountDbId = inserted!.id;
      }

      accountIds.push(accountDbId);
      accountsSynced += 1;

      try {
        const positionsResponse =
          await client.accountInformation.getAllAccountPositions({
            userId: creds.snaptradeUserId,
            userSecret: creds.userSecret,
            accountId: snaptradeAccountId,
          });

        const data = positionsResponse.data as
          | { results?: SnaptradePosition[]; positions?: SnaptradePosition[] }
          | SnaptradePosition[]
          | undefined;
        const results = Array.isArray(data)
          ? data
          : (data?.results ?? data?.positions ?? []);

        for (const position of results) {
          const ticker =
            position.symbol?.symbol?.trim() ||
            position.symbol?.description?.trim();
          if (!ticker) continue;

          const securityId = await upsertSecurity(
            db,
            ticker,
            position.symbol?.description ?? ticker,
            parseMoney(position.price ?? 0),
          );

          const quantity = parseMoney(position.units ?? 0);
          const costBasis = parseMoney(
            position.average_purchase_price ?? position.price ?? 0,
          );
          const priceNum = Number.parseFloat(parseMoney(position.price ?? 0));
          const qtyNum = Number.parseFloat(quantity);
          const institutionValue = formatMoneyAmount(priceNum * qtyNum);

          await db
            .insert(holdings)
            .values({
              userId,
              accountId: accountDbId,
              securityId,
              quantity,
              costBasis,
              institutionValue,
            })
            .onConflictDoUpdate({
              target: [holdings.accountId, holdings.securityId],
              set: {
                quantity,
                costBasis,
                institutionValue,
              },
            });
          holdingsUpdated += 1;
        }
      } catch (error) {
        log.warn(
          { err: error, snaptradeAccountId },
          "snaptrade positions sync failed",
        );
      }

      try {
        const activities = await fetchAccountActivities(
          client,
          creds,
          snaptradeAccountId,
        );

        for (const activity of activities) {
          const externalId = activity.id;
          if (!externalId) continue;

          const date =
            activity.trade_date?.slice(0, 10) ??
            activity.settlement_date?.slice(0, 10);
          if (!date) continue;

          const ticker = activity.symbol?.symbol?.trim();
          let securityId: string | null = null;
          if (ticker) {
            securityId = await upsertSecurity(
              db,
              ticker,
              activity.symbol?.description ?? ticker,
              activity.price != null ? parseMoney(activity.price) : undefined,
            );
          }

          const amount = parseMoney(activity.amount ?? 0);
          const name =
            activity.description?.trim() ||
            `${activity.type ?? "Activity"}${ticker ? ` ${ticker}` : ""}`;

          await db
            .insert(investmentTransactions)
            .values({
              userId,
              accountId: accountDbId,
              securityId,
              externalId: `snaptrade:${externalId}`,
              date,
              name,
              type: mapActivityType(activity.type),
              quantity: activity.units != null ? parseMoney(activity.units) : null,
              price:
                activity.price != null ? parseMoney(activity.price) : null,
              amount,
              fees: parseMoney(activity.fee ?? 0),
            })
            .onConflictDoNothing();
          activitiesAdded += 1;
        }
      } catch (error) {
        log.warn(
          { err: error, snaptradeAccountId },
          "snaptrade activities sync failed",
        );
      }
    }

    await ensureAccountsAssignedToOwner(userId, accountIds);
  }

  await refreshFireProfile(userId);

  log.info(
    {
      userId,
      connectionsSynced,
      accountsSynced,
      holdingsUpdated,
      activitiesAdded,
    },
    "snaptrade user synced",
  );

  return {
    connectionsSynced,
    accountsSynced,
    holdingsUpdated,
    activitiesAdded,
  };
}

export async function syncSnaptradeConnection(
  connectionDbId: string,
  userId: string,
  env: Env,
): Promise<SnaptradeSyncResult> {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(snaptradeConnections)
    .where(
      and(
        eq(snaptradeConnections.id, connectionDbId),
        eq(snaptradeConnections.userId, userId),
      ),
    )
    .limit(1);

  if (!conn) {
    throw AppError.notFound("SnapTrade connection not found");
  }

  return syncSnaptradeForUser(userId, env);
}
