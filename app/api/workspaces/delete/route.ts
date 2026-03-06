import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { cancelSubscription } from "@/lib/stripe/actions";
import {
  createActiveWorkspaceCookie,
  createClearedActiveWorkspaceCookie,
} from "@/lib/workspace-cookie";
import { buildWorkspacePath } from "@/lib/workspace-paths";

function hasStripeResourceMissingCode(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "resource_missing"
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`workspace-delete:${userId}`, {
    limit: 5,
    windowSec: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many delete attempts" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        },
      }
    );
  }

  let confirmName = "";
  try {
    const body = await request.json();
    confirmName = typeof body.confirmName === "string" ? body.confirmName.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (workspace.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can delete a workspace" },
      { status: 403 }
    );
  }

  if (confirmName !== workspace.name) {
    return NextResponse.json(
      { error: "Enter the exact workspace name to confirm deletion" },
      { status: 400 }
    );
  }

  if (workspace.stripeSubscriptionId) {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Cannot cancel billing for this workspace right now" },
        { status: 500 }
      );
    }

    try {
      await cancelSubscription({
        stripeSubscriptionId: workspace.stripeSubscriptionId,
      });
    } catch (error) {
      if (!hasStripeResourceMissingCode(error)) {
        console.error("[workspaces/delete] failed to cancel subscription:", error);
        return NextResponse.json(
          { error: "Failed to cancel billing for this workspace. Workspace was not deleted." },
          { status: 500 }
        );
      }
    }
  }

  try {
    const result = await convex.mutation(api.workspaces.deleteWorkspace, {
      workspaceId: workspace._id,
    });

    const redirectTo = result.remainingWorkspaceId
      ? buildWorkspacePath(result.remainingWorkspaceId, "/dashboard")
      : "/onboarding";

    const response = NextResponse.json({ redirectTo }, { status: 200 });
    if (result.remainingWorkspaceId) {
      response.cookies.set(createActiveWorkspaceCookie(result.remainingWorkspaceId));
    } else {
      response.cookies.set(createClearedActiveWorkspaceCookie());
    }
    return response;
  } catch (error) {
    console.error("[workspaces/delete] failed to delete workspace:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    );
  }
}
