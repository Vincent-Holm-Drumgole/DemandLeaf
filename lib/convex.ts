import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";

/**
 * Unauthenticated Convex client for API routes that don't require login
 * (crawl, generate, anonymous-session, feedback).
 */
export function getConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

/**
 * Authenticated Convex client for protected API routes.
 * Sets the Clerk JWT so Convex can verify the caller's identity.
 */
export async function getAuthedConvexClient(): Promise<ConvexHttpClient> {
  const client = getConvexClient();
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (token) client.setAuth(token);
  return client;
}
