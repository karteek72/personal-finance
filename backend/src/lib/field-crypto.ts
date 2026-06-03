import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import type { Env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";

function deriveKey(env: Env, salt: string): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ??
    (env.NODE_ENV === "development"
      ? "dev-insecure-plaid-key-change-in-production"
      : undefined);

  if (!secret) {
    throw new Error("ENCRYPTION_KEY is required in production");
  }

  return scryptSync(secret, salt, 32);
}

function packCiphertext(iv: Buffer, tag: Buffer, data: Buffer): string {
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${data.toString("base64url")}`;
}

function unpackCiphertext(ciphertext: string): {
  iv: Buffer;
  tag: Buffer;
  data: Buffer;
} {
  const [ivB64, tagB64, dataB64] = ciphertext.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }
  return {
    iv: Buffer.from(ivB64, "base64url"),
    tag: Buffer.from(tagB64, "base64url"),
    data: Buffer.from(dataB64, "base64url"),
  };
}

/** AES-256-GCM encrypt UTF-8 text (Plaid tokens, etc.). */
export function encryptField(
  plaintext: string,
  env: Env,
  salt: string,
): string {
  return encryptBytes(Buffer.from(plaintext, "utf8"), env, salt);
}

/** AES-256-GCM decrypt to UTF-8 text. */
export function decryptField(ciphertext: string, env: Env, salt: string): string {
  return decryptBytes(ciphertext, env, salt).toString("utf8");
}

/** AES-256-GCM encrypt binary blob (uploaded statement files). */
export function encryptBytes(data: Buffer, env: Env, salt: string): string {
  const key = deriveKey(env, salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return packCiphertext(iv, tag, encrypted);
}

/** AES-256-GCM decrypt binary blob. */
export function decryptBytes(
  ciphertext: string,
  env: Env,
  salt: string,
): Buffer {
  const key = deriveKey(env, salt);
  const { iv, tag, data } = unpackCiphertext(ciphertext);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
