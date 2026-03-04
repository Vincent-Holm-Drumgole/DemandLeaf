import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { createPortalSession } from "@/lib/stripe/actions";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (!workspace.stripeCustomerId) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const portalUrl = await createPortalSession({
      stripeCustomerId: workspace.stripeCustomerId,
      returnUrl: `${origin}/settings?tab=billing`,
    });

    return NextResponse.json({ url: portalUrl });
  } catch (err) {
    console.error("[stripe/portal]", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
