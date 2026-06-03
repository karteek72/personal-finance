import { Readable } from "node:stream";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AppError } from "../lib/errors.js";
import { verifyPlaidWebhookSignature } from "../services/plaid/verify-webhook.js";
import {
  handlePlaidWebhookPayload,
  type PlaidWebhookPayload,
} from "../services/plaid/webhook-sync.js";

type WebhookRequest = FastifyRequest & { rawWebhookBody?: string };

async function readRawPayload(
  payload: AsyncIterable<Buffer | string>,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of payload) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export const plaidWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (!request.url.includes("/webhooks/plaid")) {
      return payload;
    }

    const raw = await readRawPayload(payload);
    (request as WebhookRequest).rawWebhookBody = raw.toString("utf8");
    return Readable.from(raw);
  });

  app.post("/webhooks/plaid", async (request, reply) => {
    const rawBody = (request as WebhookRequest).rawWebhookBody;
    if (!rawBody) {
      throw AppError.validation("Missing webhook body");
    }

    const verification = request.headers["plaid-verification"];
    const verificationHeader = Array.isArray(verification)
      ? verification[0]
      : verification;

    const valid = await verifyPlaidWebhookSignature(
      rawBody,
      verificationHeader,
      app.config.env,
    );

    if (!valid) {
      throw AppError.unauthenticated("Invalid Plaid webhook signature");
    }

    const payload = JSON.parse(rawBody) as PlaidWebhookPayload;
    await handlePlaidWebhookPayload(payload, app.config.env);
    return reply.status(200).send({ received: true });
  });
};
