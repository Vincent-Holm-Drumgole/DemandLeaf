import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const windowDays = Math.min(
    Math.max(parseInt(searchParams.get("windowDays") ?? "30", 10), 7),
    90
  );

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const data = await convex.query(api.confidenceScores.getWorkspaceTrend, {
      workspaceId: workspace._id,
      windowDays: isNaN(windowDays) ? 30 : windowDays,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[confidence/GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch confidence data" }, { status: 500 });
  }
}
