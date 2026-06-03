import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { deleteAccount, getAccount } from "../services/account-store.js";
import { syncPlaidItem } from "../services/plaid/sync.js";
import { listAccounts } from "../services/transaction-store.js";

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/accounts", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return listAccounts(user.id);
  });

  app.delete("/accounts/:accountId", async (request) => {
    const { accountId } = request.params as { accountId: string };
    const user = await requireRequestUser(request, app.config.env);

    const result = await deleteAccount(accountId, user.id);
    if (!result) {
      throw AppError.notFound("Account not found");
    }

    return result;
  });

  app.post("/accounts/:accountId/sync", async (request) => {
    const { accountId } = request.params as { accountId: string };
    const user = await requireRequestUser(request, app.config.env);
    const account = await getAccount(accountId, user.id);

    if (!account) {
      throw AppError.notFound("Account not found");
    }

    if (!account.plaidItemId) {
      throw AppError.notPlaidAccount();
    }

    try {
      const syncResult = await syncPlaidItem(account.plaidItemId, app.config.env);
      return { status: "completed", ...syncResult };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.plaidSyncError("Unable to sync account", error);
    }
  });
};
