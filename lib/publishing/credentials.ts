import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.WP_CREDENTIALS_KEY;
  if (!raw || raw.length < 32) {
    throw new Error("WP_CREDENTIALS_KEY env var must be set (32+ chars)");
  }
  return Buffer.from(raw.slice(0, 32), "utf8");
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
