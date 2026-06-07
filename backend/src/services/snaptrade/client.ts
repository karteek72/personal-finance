import { Snaptrade } from "snaptrade-typescript-sdk";
import type { Env } from "../../config/env.js";
import { isSnaptradeConfigured } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";

let snaptradeClient: Snaptrade | null = null;

export function getSnaptradeClient(env: Env): Snaptrade {
  if (!isSnaptradeConfigured(env)) {
    throw AppError.providerNotConfigured("SnapTrade");
  }

  if (!snaptradeClient) {
    snaptradeClient = new Snaptrade({
      clientId: env.SNAPTRADE_CLIENT_ID!,
      consumerKey: env.SNAPTRADE_CONSUMER_KEY!,
    });
  }

  return snaptradeClient;
}

export function resolveSnaptradeRedirectUri(env: Env): string {
  const explicit = env.SNAPTRADE_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const base = env.UI_APP_URL.replace(/\/$/, "");
  return `${base}/accounts/snaptrade/callback`;
}
