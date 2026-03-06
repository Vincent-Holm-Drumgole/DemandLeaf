import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`roi:${userId}`, {
    limit: 30,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } }
    );
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const googleConn = await convex.query(api.googleConnections.getByWorkspace, {
      workspaceId: workspace._id,
    });
    const googleConnected = googleConn?.status === "connected";

    // Get all published blogs for this workspace
    const blogs = await convex.query(api.blogs.listByWorkspaceId, {
      workspaceId: workspace._id,
    });
    const publishedBlogs = blogs.filter(
      (b: { status: string }) => b.status === "published"
    );

    // Get recent rank snapshots (last 30 days)
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentSnapshots = await convex.query(
      api.rankSnapshots.getRecentForWorkspace,
      { workspaceId: workspace._id, since }
    );

    // Count posts ranking in top 20
    const rankingBlogIds = new Set<string>();
    for (const snap of recentSnapshots) {
      if (snap.position != null && snap.position <= 20) {
        rankingBlogIds.add(snap.blogId);
      }
    }

    // Average position across latest snapshots per blog
    const latestPerBlog = new Map<string, number>();
    for (const snap of recentSnapshots) {
      if (snap.position != null && !latestPerBlog.has(snap.blogId)) {
        latestPerBlog.set(snap.blogId, snap.position);
      }
    }
    const positions = [...latestPerBlog.values()];
    const avgPosition =
      positions.length > 0
        ? Math.round(
            (positions.reduce((a, b) => a + b, 0) / positions.length) * 10
          ) / 10
        : null;

    // Total generation cost
    const totalGenerationCostCents = publishedBlogs.reduce(
      (sum: number, b: { generationCostCents?: number }) =>
        sum + (b.generationCostCents ?? 0),
      0
    );

    // GA4/GSC data — only available with Google connection
    if (!googleConnected) {
      return NextResponse.json({
        available: false,
        reason: "ga4_not_connected",
        totalClicks: null,
        totalSessions: null,
        estimatedTrafficValue: null,
        totalGenerationCostCents,
        postsRanking: rankingBlogIds.size,
        avgPosition,
        positionChangeLastMonth: null,
      });
    }

    // Aggregate performance metrics from last 30 days
    // Note: actual GA4/GSC fetching happens via daily Inngest sync
    // This route just reads from performanceMetrics table
    const allMetrics = await convex.query(
      api.performanceMetrics.getRecentForWorkspace,
      { workspaceId: workspace._id, since }
    );

    const totalClicks = allMetrics.reduce(
      (sum: number, m: { clicks?: number | null }) => sum + (m.clicks ?? 0),
      0
    );
    const totalSessions = allMetrics.reduce(
      (sum: number, m: { sessions?: number | null }) =>
        sum + (m.sessions ?? 0),
      0
    );

    // Rough traffic value estimate: clicks * $2 avg CPC (configurable)
    const AVG_CPC_ESTIMATE = 2.0;
    const estimatedTrafficValue = Math.round(totalClicks * AVG_CPC_ESTIMATE * 100) / 100;

    return NextResponse.json({
      available: true,
      totalClicks,
      totalSessions,
      estimatedTrafficValue,
      totalGenerationCostCents,
      postsRanking: rankingBlogIds.size,
      avgPosition,
      positionChangeLastMonth: null,
    });
  } catch (err) {
    console.error("[roi/GET]", err);
    return NextResponse.json(
      { error: "Failed to load ROI data" },
      { status: 500 }
    );
  }
}
