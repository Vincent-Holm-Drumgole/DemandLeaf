import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { encryptTokens } from "@/lib/google/credentials";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=missing_params", request.url)
    );
  }

  const workspaceId = parseConvexId(state, "workspaces");
  if (!workspaceId) {
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=invalid_state", request.url)
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace || workspace._id !== workspaceId) {
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=invalid_state", request.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { encrypted, iv, tag } = encryptTokens(tokens);

    // Check if connection already exists
    const existing = await convex.query(api.googleConnections.getByWorkspace, {
      workspaceId,
    });

    if (existing) {
      await convex.mutation(api.googleConnections.updateTokens, {
        connectionId: existing._id,
        encryptedTokens: encrypted,
        tokenIv: iv,
        tokenTag: tag,
      });
      await convex.mutation(api.googleConnections.updateStatus, {
        connectionId: existing._id,
        status: "connected",
      });
    } else {
      await convex.mutation(api.googleConnections.create, {
        workspaceId,
        encryptedTokens: encrypted,
        tokenIv: iv,
        tokenTag: tag,
        scopes: [
          "https://www.googleapis.com/auth/analytics.readonly",
          "https://www.googleapis.com/auth/webmasters.readonly",
        ],
      });
    }

    return NextResponse.redirect(
      new URL("/settings?tab=integrations&success=google_connected", request.url)
    );
  } catch (err) {
    console.error("[google-auth/callback]", err);
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=auth_failed", request.url)
    );
  }
}
