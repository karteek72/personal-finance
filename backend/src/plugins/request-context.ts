import type { FastifyPluginAsync } from "fastify";

export const REQUEST_ID_HEADER = "x-request-id";

/** Complements Fastify `genReqId` — logs one line per completed request. */
export const requestContextPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onResponse", async (request, reply) => {
    const level =
      reply.statusCode >= 500
        ? "error"
        : reply.statusCode >= 400
          ? "warn"
          : "info";

    request.log[level](
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
        requestId: request.id,
        userId: request.spendflowUser?.id,
        userEmail: request.spendflowUser?.email,
      },
      "request completed",
    );
  });
};
