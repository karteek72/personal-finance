import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getPlaidClient,
  parseCountryCodes,
  parsePlaidProducts,
} from "../services/plaid/client.js";
import { getPlaidAccountsResponse } from "./transactions.js";

const linkTokenBodySchema = z.object({
  platform: z.enum(["web", "ios"]).optional(),
});

const exchangeTokenBodySchema = z.object({
  publicToken: z.string().min(1),
});

export const plaidRoutes: FastifyPluginAsync = async (app) => {
  app.post("/plaid/link-token", async (request, reply) => {
    const body = linkTokenBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      });
    }

    try {
      const client = getPlaidClient(app.config.env);
      const response = await client.linkTokenCreate({
        user: { client_user_id: "dev-user-1" },
        client_name: "SpendFlow",
        products: parsePlaidProducts(app.config.env.PLAID_PRODUCTS),
        country_codes: parseCountryCodes(app.config.env.PLAID_COUNTRY_CODES),
        language: "en",
        webhook: `${app.config.env.APP_URL}/api/v1/webhooks/plaid`,
      });

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
      const client = getPlaidClient(app.config.env);
      const response = await client.itemPublicTokenExchange({
        public_token: body.data.publicToken,
      });

      return {
        itemId: response.data.item_id,
        institutionName: "Connected institution",
        message:
          "Token exchanged successfully. Database persistence will be added in the next phase.",
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

  app.get("/plaid/accounts", async () => getPlaidAccountsResponse());
};
