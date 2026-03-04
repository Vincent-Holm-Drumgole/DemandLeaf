import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { GoogleTokens } from "@/types";

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  workspaceId: string;
  userId: string;
  issuedAt: number;
  nonce: string;
}

function getClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be set"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

function getStateSecret(): string {
  return process.env.GOOGLE_OAUTH_STATE_SECRET ?? getClientConfig().clientSecret;
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : normalized + "=".repeat(4 - remainder);
  return Buffer.from(padded, "base64");
}

function signState(payloadBase64: string): string {
  return toBase64Url(
    createHmac("sha256", getStateSecret())
      .update(payloadBase64)
      .digest()
  );
}

export function createOAuthState(workspaceId: string, userId: string): string {
  const payload: OAuthStatePayload = {
    workspaceId,
    userId,
    issuedAt: Date.now(),
    nonce: toBase64Url(randomBytes(16)),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${signState(encodedPayload)}`;
}

export function parseOAuthState(state: string): { workspaceId: string; userId: string } | null {
  const [encodedPayload, encodedSignature] = state.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = signState(encodedPayload);
  const providedSig = Buffer.from(encodedSignature);
  const expectedSig = Buffer.from(expectedSignature);
  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(providedSig, expectedSig)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as Partial<OAuthStatePayload>;
    if (
      typeof payload.workspaceId !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.issuedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - payload.issuedAt > OAUTH_STATE_MAX_AGE_MS) {
      return null;
    }
    return { workspaceId: payload.workspaceId, userId: payload.userId };
  } catch {
    return null;
  }
}

export function buildAuthUrl(workspaceId: string, userId: string): string {
  const { clientId, redirectUri } = getClientConfig();
  const state = createOAuthState(workspaceId, userId);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getClientConfig();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Google token exchange failed: ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };

  if (!data.refresh_token) {
    throw new Error(
      "No refresh token returned. Ensure access_type=offline and prompt=consent."
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
  };
}

export async function refreshAccessToken(
  tokens: GoogleTokens
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getClientConfig();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Google token refresh failed: ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  return {
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
  };
}
