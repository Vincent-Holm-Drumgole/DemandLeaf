import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`confidence:${userId}`, { limit: 120, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawWindowDays = Number(searchParams.get("windowDays") ?? "30");
  const windowDays = Number.isFinite(rawWindowDays)
    ? Math.min(Math.max(Math.floor(rawWindowDays), 7), 90)
    : 30;

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const data = await convex.query(api.confidenceScores.getWorkspaceTrend, {
      workspaceId: workspace._id,
      windowDays,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[confidence/GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch confidence data" }, { status: 500 });
  }
}
