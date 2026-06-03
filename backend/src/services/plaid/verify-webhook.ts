import { createHash } from "node:crypto";
import { importJWK, jwtVerify } from "jose";
import type { Env } from "../../config/env.js";
import { getPlaidClient } from "./client.js";

const KEY_CACHE = new Map<string, CryptoKey>();

export async function verifyPlaidWebhookSignature(
  rawBody: string,
  verificationHeader: string | undefined,
  env: Env,
): Promise<boolean> {
  if (!verificationHeader) {
    return env.NODE_ENV === "development";
  }

  try {
    const headerPart = verificationHeader.split(".")[0] ?? "";
    const header = JSON.parse(
      Buffer.from(headerPart, "base64url").toString("utf8"),
    ) as { kid?: string };

    const kid = header.kid;
    if (!kid) {
      return false;
    }

    let key = KEY_CACHE.get(kid);
    if (!key) {
      const client = getPlaidClient(env);
      const keyResponse = await client.webhookVerificationKeyGet({
        key_id: kid,
      });
      key = (await importJWK(
        keyResponse.data.key as Parameters<typeof importJWK>[0],
        "ES256",
      )) as CryptoKey;
      KEY_CACHE.set(kid, key);
    }

    const { payload } = await jwtVerify(verificationHeader, key, {
      maxTokenAge: "5 min",
    });

    const claimedHash = payload.request_body_sha256;
    if (typeof claimedHash !== "string") {
      return false;
    }

    const bodyHash = createHash("sha256").update(rawBody).digest("hex");
    return bodyHash === claimedHash;
  } catch {
    return false;
  }
}
