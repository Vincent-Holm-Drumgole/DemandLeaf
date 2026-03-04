import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ blogId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`perf:${userId}`, {
    limit: 60,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { blogId: rawId } = await context.params;
  const blogId = parseConvexId(rawId, "blogs");
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const blog = await convex.query(api.blogs.getById, { blogId });
  if (!blog || blog.workspaceId !== workspace._id) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  const [googleConn, metrics, alerts] = await Promise.all([
    convex.query(api.googleConnections.getByWorkspace, {
      workspaceId: workspace._id,
    }),
    convex.query(api.performanceMetrics.getMetricsForBlog, {
      blogId,
      limit: 12,
    }),
    convex.query(api.decayAlerts.listByBlog, { blogId }),
  ]);

  return NextResponse.json({
    googleConnected: googleConn?.status === "connected",
    metrics: metrics.map((m) => ({
      id: m._id,
      sessions: m.sessions ?? null,
      pageviews: m.pageviews ?? null,
      clicks: m.clicks ?? null,
      impressions: m.impressions ?? null,
      ctr: m.ctr ?? null,
      avgPosition: m.avgPosition ?? null,
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
    })),
    alerts: alerts.map((a) => ({
      id: a._id,
      alertType: a.alertType,
      severity: a.severity,
      triggeredAt: a.triggeredAt,
      status: a.status,
      deltaPercent: a.deltaPercent,
      diagnosisCause: a.diagnosisCause ?? null,
    })),
  });
}
