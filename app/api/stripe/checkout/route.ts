import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createCheckoutSession } from "@/lib/stripe/actions";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`checkout:${userId}`, {
    limit: 5,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 500 }
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  const origin = new URL(request.url).origin;

  try {
    const checkoutUrl = await createCheckoutSession({
      workspaceId: workspace._id,
      userId,
      email,
      stripeCustomerId: workspace.stripeCustomerId ?? undefined,
      priceId,
      successUrl: `${origin}/settings?tab=billing&success=subscribed`,
      cancelUrl: `${origin}/settings?tab=billing`,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
