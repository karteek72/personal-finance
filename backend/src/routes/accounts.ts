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

    const result = await deleteAccount(accountId, user.id, app.config.env);
    if (!result) {
      throw AppError.notFound("Account not found");
    }

    return result;
  });

  app.post("/accounts/:accountId/sync", async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const user = await requireRequestUser(request, app.config.env);
    const account = await getAccount(accountId, user.id);

    if (!account) {
      throw AppError.notFound("Account not found");
    }

    if (account.userId !== user.id) {
      throw AppError.forbidden("Only the account owner can sync this account");
    }

    if (!account.plaidItemId) {
      throw AppError.notPlaidAccount();
    }

    const env = app.config.env;
    const itemDbId = account.plaidItemId;
    const operationId = request.id;

    request.log.info(
      {
        operation: "plaid.sync_item",
        operationId,
        stage: "queued",
        userId: user.id,
        userEmail: user.email,
        accountId,
        accountName: account.name,
        accountMask: account.mask,
        itemDbId,
        institutionName: account.institutionName,
        trigger: "api_account_sync",
      },
      "Plaid account sync accepted — background sync queued",
    );

    void syncPlaidItem(itemDbId, env, {
      operationId,
      trigger: "api_account_sync",
      requestId: request.id,
    }).catch((error: unknown) => {
      request.log.error(
        {
          err: error,
          operation: "plaid.sync_item",
          operationId,
          userId: user.id,
          userEmail: user.email,
          accountId,
          accountName: account.name,
          itemDbId,
          stage: "failed",
        },
        "Plaid account background sync failed",
      );
    });

    return reply.status(202).send({
      status: "started",
      itemId: itemDbId,
      institutionName: account.institutionName,
      accountsSynced: 1,
      added: 0,
      modified: 0,
      removed: 0,
      message:
        "Sync started in the background. This account will update shortly.",
    });
  });
};
