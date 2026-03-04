import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.WP_CREDENTIALS_KEY;
  if (!raw) {
    throw new Error("WP_CREDENTIALS_KEY env var must be set");
  }
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.from(raw, "utf8");
  if (buf.length < 32) {
    throw new Error("WP_CREDENTIALS_KEY must be at least 32 bytes");
  }
  return buf.subarray(0, 32);
}

export function encryptCredentials(plain: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    encrypted: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptCredentials(
  encrypted: string,
  iv: string,
  tag: string
): string {
  const key = getKey();
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
