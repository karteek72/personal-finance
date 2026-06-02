import type { FastifyPluginAsync } from "fastify";
import { deleteAccount, getAccount } from "../services/account-store.js";
import { syncPlaidItem } from "../services/plaid/sync.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { listAccounts } from "../services/transaction-store.js";

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/accounts", async () => {
    return listAccounts();
  });

  app.delete("/accounts/:accountId", async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;

    const result = await deleteAccount(accountId, user.id);
    if (!result) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Account not found" },
      });
    }

    return result;
  });

  app.post("/accounts/:accountId/sync", async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    const account = await getAccount(accountId, user.id);

    if (!account) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Account not found" },
      });
    }

    if (!account.plaidItemId) {
      return reply.status(400).send({
        error: {
          code: "NOT_PLAID_ACCOUNT",
          message: "Only Plaid-linked accounts can be synced",
        },
      });
    }

    try {
      const syncResult = await syncPlaidItem(
        account.plaidItemId,
        app.config.env,
      );
      return { status: "completed", ...syncResult };
    } catch (error) {
      app.log.error({ err: error }, "Account sync failed");
      return reply.status(502).send({
        error: {
          code: "PLAID_SYNC_ERROR",
          message: "Unable to sync account",
        },
      });
    }
  });
};
