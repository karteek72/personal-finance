import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseBody } from "../lib/validate.js";
import {
  getPlaidClient,
  parseCountryCodes,
  parsePlaidProducts,
} from "../services/plaid/client.js";
import { Products } from "plaid";
import {
  deletePlaidItem,
  exchangeAndSync,
  listPlaidItems,
  syncAllPlaidItems,
} from "../services/plaid/item-store.js";
import { syncPlaidItem } from "../services/plaid/sync.js";
import { getPlaidAccountsResponse } from "./transactions.js";

const linkTokenBodySchema = z.object({
  platform: z.enum(["web", "ios"]).optional(),
});

const exchangeTokenBodySchema = z.object({
  publicToken: z.string().min(1),
});

function resolvePlaidRedirectUri(env: {
  PLAID_ENV: string;
  PLAID_REDIRECT_URI?: string;
}): string | undefined {
  const uri = env.PLAID_REDIRECT_URI?.trim();
  if (!uri) return undefined;
  if (env.PLAID_ENV === "production" && !uri.startsWith("https://")) {
    return undefined;
  }
  return uri;
}

export const plaidRoutes: FastifyPluginAsync = async (app) => {
  app.post("/plaid/link-token", async (request) => {
    parseBody(linkTokenBodySchema, request.body);

    const user = await requireRequestUser(request, app.config.env);
    const client = getPlaidClient(app.config.env);
    const products = parsePlaidProducts(app.config.env.PLAID_PRODUCTS);
    const linkTokenRequest: Parameters<typeof client.linkTokenCreate>[0] = {
      user: { client_user_id: user.id },
      client_name: "SpendFlow",
      products,
      country_codes: parseCountryCodes(app.config.env.PLAID_COUNTRY_CODES),
      language: "en",
      webhook: `${app.config.env.APP_URL}/api/v1/webhooks/plaid`,
    };

    if (products.includes(Products.Transactions)) {
      linkTokenRequest.transactions = { days_requested: 730 };
    }

    const redirectUri = resolvePlaidRedirectUri(app.config.env);
    if (redirectUri) {
      linkTokenRequest.redirect_uri = redirectUri;
    } else if (app.config.env.PLAID_REDIRECT_URI) {
      request.log.warn(
        "PLAID_REDIRECT_URI ignored — production requires HTTPS. Use ngrok or deploy for OAuth banks.",
      );
    }

    try {
      const response = await client.linkTokenCreate(linkTokenRequest);
      return { linkToken: response.data.link_token };
    } catch (error) {
      throw AppError.plaidError("Unable to create Plaid link token", error);
    }
  });

  app.post("/plaid/exchange-token", async (request) => {
    const body = parseBody(
      exchangeTokenBodySchema,
      request.body,
      "publicToken is required",
    );
    const user = await requireRequestUser(request, app.config.env);

    try {
      const client = getPlaidClient(app.config.env);
      const response = await client.itemPublicTokenExchange({
        public_token: body.publicToken,
      });

      const { item, syncResult } = await exchangeAndSync(
        user.id,
        response.data.item_id,
        response.data.access_token,
        app.config.env,
      );

      request.log.info(
        {
          userId: user.id,
          itemId: item.plaidItemId,
          transactionsAdded: syncResult.added,
        },
        "plaid account connected",
      );

      return {
        itemId: item.plaidItemId,
        institutionName: syncResult.institutionName,
        accountsSynced: syncResult.accountsSynced,
        transactionsAdded: syncResult.added,
        message: "Account connected and transactions synced.",
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.plaidError("Unable to exchange Plaid public token", error);
    }
  });

  app.get("/plaid/accounts", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getPlaidAccountsResponse(user.id);
  });

  app.get("/plaid/items", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const items = await listPlaidItems(user.id);
    return { items };
  });

  app.post("/plaid/sync", async (request, reply) => {
    const user = await requireRequestUser(request, app.config.env);
    const env = app.config.env;
    const operationId = request.id;

    request.log.info(
      {
        operation: "plaid.sync_all",
        operationId,
        stage: "queued",
        userId: user.id,
        userEmail: user.email,
        trigger: "api_refresh_all",
      },
      "Plaid refresh-all accepted — background sync queued",
    );

    void syncAllPlaidItems(user.id, env, {
      operationId,
      trigger: "api_refresh_all",
      requestId: request.id,
      userEmail: user.email,
    }).catch((error: unknown) => {
      request.log.error(
        {
          err: error,
          operation: "plaid.sync_all",
          operationId,
          userId: user.id,
          userEmail: user.email,
          stage: "failed",
        },
        "Plaid refresh-all background sync failed",
      );
    });

    return reply.status(202).send({
      status: "started",
      itemsSynced: 0,
      added: 0,
      modified: 0,
      removed: 0,
      message:
        "Sync started in the background. Balances and transactions will update shortly.",
    });
  });

  app.post("/plaid/items/:itemId/sync", async (request) => {
    const { itemId } = request.params as { itemId: string };
    const user = await requireRequestUser(request, app.config.env);
    const items = await listPlaidItems(user.id);
    const item = items.find(
      (row) => row.id === itemId || row.plaidItemId === itemId,
    );

    if (!item) {
      throw AppError.notFound("Plaid item not found");
    }

    request.log.info(
      {
        operation: "plaid.sync_item",
        operationId: request.id,
        stage: "started",
        userId: user.id,
        userEmail: user.email,
        itemDbId: item.id,
        plaidItemId: item.plaidItemId,
        institutionName: item.institutionName,
        trigger: "api_item_sync",
      },
      "Plaid single-item sync started (synchronous)",
    );

    try {
      const syncResult = await syncPlaidItem(item.id, app.config.env, {
        operationId: request.id,
        trigger: "api_item_sync",
        requestId: request.id,
      });
      return { status: "completed", ...syncResult };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.plaidSyncError("Unable to sync Plaid item", error);
    }
  });

  app.delete("/plaid/items/:itemId", async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const user = await requireRequestUser(request, app.config.env);
    const items = await listPlaidItems(user.id);
    const item = items.find(
      (row) => row.id === itemId || row.plaidItemId === itemId,
    );

    if (!item) {
      throw AppError.notFound("Plaid item not found");
    }

    try {
      await deletePlaidItem(item.id, user.id);
      request.log.info({ userId: user.id, itemId: item.id }, "plaid item removed");
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.plaidError("Unable to disconnect Plaid item", error);
    }
  });
};
