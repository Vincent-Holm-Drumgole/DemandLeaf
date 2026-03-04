import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Resolve a Clerk user's primary email via Clerk Backend API.
 * Returns null when unavailable so callers can gracefully skip email sends.
 */
export async function getClerkUserPrimaryEmail(clerkUserId: string): Promise<string | null> {
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(clerkUserId);
    const emails = user.emailAddresses ?? [];
    if (emails.length === 0) return null;

    const primary = emails.find((email) => email.id === user.primaryEmailAddressId);
    return primary?.emailAddress ?? emails[0]?.emailAddress ?? null;
  } catch (err) {
    console.error("[email] Clerk user lookup error:", err);
    return null;
  }
}
