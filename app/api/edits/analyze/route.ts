import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // Check that there are enough classified edits before triggering analysis
  const stats = await convex.query(api.blogEdits.getEditStats, {
    workspaceId: workspace._id,
  });

  if (stats.classified < 5) {
    return NextResponse.json({
      error: `Not enough classified edits for pattern analysis (${stats.classified}/5 minimum)`,
    }, { status: 422 });
  }

  try {
    // Schedule the pattern analysis action (runs async in Convex)
    await convex.action(api.blogEdits.analyzeEditPatterns, {
      workspaceId: workspace._id,
    });
    return NextResponse.json({ success: true, message: "Pattern analysis started" });
  } catch (err) {
    console.error("[edits/analyze/POST] error:", err);
    return NextResponse.json({ error: "Failed to start pattern analysis" }, { status: 500 });
  }
}
