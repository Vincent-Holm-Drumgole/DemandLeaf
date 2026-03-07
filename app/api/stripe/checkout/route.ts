import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { isBillingEnabledServer } from "@/lib/billing-config";
import { checkRateLimit } from "@/lib/rate-limit";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { buildWorkspacePath } from "@/lib/workspace-paths";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBillingEnabledServer()) {
    return NextResponse.json({ error: "Billing is not enabled yet" }, { status: 503 });
  }

  const rl = await checkRateLimit(`checkout:${userId}`, {
    limit: 5,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } }
    );
  }

  const priceId = process.env.STRIPE_PRICE_ID!;

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.trim() ?? "";

  const origin = new URL(request.url).origin;

  try {
    const checkoutUrl = await createCheckoutSession({
      workspaceId: workspace._id,
      userId,
      email,
      stripeCustomerId: workspace.stripeCustomerId ?? undefined,
      priceId,
      successUrl: `${origin}${buildWorkspacePath(workspace._id, "/settings?tab=billing&success=subscribed")}`,
      cancelUrl: `${origin}${buildWorkspacePath(workspace._id, "/settings?tab=billing")}`,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[stripe/checkout]", {
      err,
      userId,
      workspaceId: workspace._id,
      hasEmail: email.length > 0,
      hasStripeCustomerId: Boolean(workspace.stripeCustomerId),
    });
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
