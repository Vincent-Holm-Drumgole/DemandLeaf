import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = checkRateLimit(`edits-analyze:${userId}`, { limit: 10, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  void request;

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // Check that there are enough classified edits before triggering analysis
  const readiness = await convex.query(api.blogEdits.hasMinimumClassifiedEdits, {
    workspaceId: workspace._id,
    minimum: 5,
  });

  if (!readiness.ready) {
    return NextResponse.json({
      error: `Not enough classified edits for pattern analysis (${readiness.count}/${readiness.minimum} minimum)`,
    }, { status: 422 });
  }

  try {
    await convex.mutation(api.blogEdits.requestPatternAnalysis, {
      workspaceId: workspace._id,
    });
    return NextResponse.json({ success: true, message: "Pattern analysis started" });
  } catch (err) {
    console.error("[edits/analyze/POST] error:", err);
    return NextResponse.json({ error: "Failed to start pattern analysis" }, { status: 500 });
  }
}
