import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import type { Env } from "../../config/env.js";

const ALGORITHM = "aes-256-gcm";
const SALT = "spendflow-plaid-v1";

function deriveKey(env: Env): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ??
    (env.NODE_ENV === "development"
      ? "dev-insecure-plaid-key-change-in-production"
      : undefined);

  if (!secret) {
    throw new Error("ENCRYPTION_KEY is required in production");
  }

  return scryptSync(secret, SALT, 32);
}

export function encryptPlaidToken(plaintext: string, env: Env): string {
  const key = deriveKey(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptPlaidToken(ciphertext: string, env: Env): string {
  const key = deriveKey(env);
  const [ivB64, tagB64, dataB64] = ciphertext.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted token format");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
