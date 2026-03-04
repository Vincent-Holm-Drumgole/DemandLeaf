import "server-only";

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserResponse {
  primary_email_address_id?: string;
  email_addresses?: ClerkEmailAddress[];
}

/**
 * Resolve a Clerk user's primary email via Clerk Backend API.
 * Returns null when unavailable so callers can gracefully skip email sends.
 */
export async function getClerkUserPrimaryEmail(clerkUserId: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.warn("[email] CLERK_SECRET_KEY missing, skipping email lookup");
    return null;
  }

  try {
    const res = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) {
      console.error(`[email] Clerk user lookup failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const user = (await res.json()) as ClerkUserResponse;
    const emails = user.email_addresses ?? [];
    if (emails.length === 0) return null;

    const primary = emails.find((email) => email.id === user.primary_email_address_id);
    return primary?.email_address ?? emails[0]?.email_address ?? null;
  } catch (err) {
    console.error("[email] Clerk user lookup error:", err);
    return null;
  }
}
