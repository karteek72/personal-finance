import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getPlaidClient,
  parseCountryCodes,
  parsePlaidProducts,
} from "../services/plaid/client.js";
import {
  deletePlaidItem,
  exchangeAndSync,
  listPlaidItems,
  syncAllPlaidItems,
} from "../services/plaid/item-store.js";
import { syncPlaidItem } from "../services/plaid/sync.js";
import { requireRequestUser } from "../lib/auth-http.js";
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
  app.post("/plaid/link-token", async (request, reply) => {
    const body = linkTokenBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      });
    }

    try {
      const user = await requireRequestUser(request, reply, app.config.env);
      if (!user) return;
      const client = getPlaidClient(app.config.env);
      const linkTokenRequest: Parameters<typeof client.linkTokenCreate>[0] = {
        user: { client_user_id: user.id },
        client_name: "SpendFlow",
        products: parsePlaidProducts(app.config.env.PLAID_PRODUCTS),
        country_codes: parseCountryCodes(app.config.env.PLAID_COUNTRY_CODES),
        language: "en",
        webhook: `${app.config.env.APP_URL}/api/v1/webhooks/plaid`,
      };

      const redirectUri = resolvePlaidRedirectUri(app.config.env);
      if (redirectUri) {
        linkTokenRequest.redirect_uri = redirectUri;
      } else if (app.config.env.PLAID_REDIRECT_URI) {
        app.log.warn(
          "PLAID_REDIRECT_URI ignored — production requires HTTPS. Use ngrok or deploy for OAuth banks.",
        );
      }

      const response = await client.linkTokenCreate(linkTokenRequest);

      return { linkToken: response.data.link_token };
    } catch (error) {
      app.log.error({ err: error }, "Plaid link token creation failed");
      return reply.status(502).send({
        error: {
          code: "PLAID_ERROR",
          message: "Unable to create Plaid link token",
        },
      });
    }
  });

  app.post("/plaid/exchange-token", async (request, reply) => {
    const body = exchangeTokenBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "publicToken is required" },
      });
    }

    try {
      const user = await requireRequestUser(request, reply, app.config.env);
      if (!user) return;
      const client = getPlaidClient(app.config.env);
      const response = await client.itemPublicTokenExchange({
        public_token: body.data.publicToken,
      });

      const { item, syncResult } = await exchangeAndSync(
        user.id,
        response.data.item_id,
        response.data.access_token,
        app.config.env,
      );

      return {
        itemId: item.plaidItemId,
        institutionName: syncResult.institutionName,
        accountsSynced: syncResult.accountsSynced,
        transactionsAdded: syncResult.added,
        message: "Account connected and transactions synced.",
      };
    } catch (error) {
      app.log.error({ err: error }, "Plaid token exchange failed");
      return reply.status(502).send({
        error: {
          code: "PLAID_ERROR",
          message: "Unable to exchange Plaid public token",
        },
      });
    }
  });

  app.get("/plaid/accounts", async (request, reply) => {
    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    return getPlaidAccountsResponse(user.id);
  });

  app.get("/plaid/items", async (request, reply) => {
    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    const items = await listPlaidItems(user.id);
    return { items };
  });

  app.post("/plaid/sync", async (request, reply) => {
    try {
      const user = await requireRequestUser(request, reply, app.config.env);
      if (!user) return;
      const result = await syncAllPlaidItems(user.id, app.config.env);
      return result;
    } catch (error) {
      app.log.error({ err: error }, "Plaid sync all failed");
      return reply.status(502).send({
        error: {
          code: "PLAID_SYNC_ERROR",
          message: "Unable to sync Plaid accounts",
        },
      });
    }
  });

  app.post("/plaid/items/:itemId/sync", async (request, reply) => {
    const params = request.params as { itemId: string };

    try {
      const user = await requireRequestUser(request, reply, app.config.env);
      if (!user) return;
      const items = await listPlaidItems(user.id);
      const item = items.find(
        (row) => row.id === params.itemId || row.plaidItemId === params.itemId,
      );

      if (!item) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Plaid item not found" },
        });
      }

      const syncResult = await syncPlaidItem(item.id, app.config.env);
      return { status: "completed", ...syncResult };
    } catch (error) {
      app.log.error({ err: error }, "Plaid sync failed");
      return reply.status(502).send({
        error: {
          code: "PLAID_SYNC_ERROR",
          message: "Unable to sync Plaid item",
        },
      });
    }
  });

  app.delete("/plaid/items/:itemId", async (request, reply) => {
    const params = request.params as { itemId: string };
    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    const items = await listPlaidItems(user.id);
    const item = items.find(
      (row) => row.id === params.itemId || row.plaidItemId === params.itemId,
    );

    if (!item) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Plaid item not found" },
      });
    }

    try {
      await deletePlaidItem(item.id, user.id);
      return reply.status(204).send();
    } catch (error) {
      app.log.error({ err: error }, "Plaid item delete failed");
      return reply.status(502).send({
        error: {
          code: "PLAID_ERROR",
          message: "Unable to disconnect Plaid item",
        },
      });
    }
  });
};
