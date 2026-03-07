import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { diagnoseCause } from "@/lib/decay/diagnoser";
import { getSerpResults } from "@/lib/seo-data/dataforseo";

export async function POST(
  _request: Request,
  context: { params: Promise<{ alertId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`diagnose:${userId}`, {
    limit: 20,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } }
    );
  }

  const { alertId: rawId } = await context.params;
  const alertId = parseConvexId(rawId, "decayAlerts");
  if (!alertId) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const alert = await convex.query(api.decayAlerts.getById, { alertId });
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const blog = await convex.query(api.blogs.getById, { blogId: alert.blogId });
  if (!blog) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  try {
    const [snapshots, metrics, serpResults] = await Promise.all([
      convex.query(api.rankSnapshots.getSnapshotsForBlog, {
        blogId: alert.blogId,
        limit: 8,
      }),
      convex.query(api.performanceMetrics.getMetricsForBlog, {
        blogId: alert.blogId,
        limit: 8,
      }),
      blog.focusKeyword
        ? getSerpResults(convex, blog.focusKeyword)
        : Promise.resolve([] as { position: number; title: string; snippet: string }[]),
    ]);

    const blogAgeDays = blog.publishedAt
      ? Math.floor((Date.now() - blog.publishedAt) / (24 * 60 * 60 * 1000))
      : Math.floor((Date.now() - blog.createdAt) / (24 * 60 * 60 * 1000));

    const diagnosis = await diagnoseCause({
      alertType: alert.alertType,
      severity: alert.severity,
      deltaPercent: alert.deltaPercent,
      blogTitle: blog.title,
      keyword: blog.focusKeyword ?? "",
      blogAgeDays,
      wordCount: blog.wordCount ?? 0,
      rankHistory: snapshots.map((s: { checkedAt: number; position?: number | null }) => ({
        date: new Date(s.checkedAt).toISOString().split("T")[0],
        position: s.position ?? null,
      })),
      performanceHistory: metrics.map(
        (m: {
          periodStart: number;
          clicks?: number | null;
          impressions?: number | null;
          ctr?: number | null;
        }) => ({
          date: new Date(m.periodStart).toISOString().split("T")[0],
          clicks: m.clicks ?? null,
          impressions: m.impressions ?? null,
          ctr: m.ctr ?? null,
        })
      ),
      serpTop5: serpResults.slice(0, 5).map((s) => ({
        position: s.position,
        title: s.title,
        snippet: s.snippet,
      })),
    });

    // Persist diagnosis to the alert
    await convex.mutation(api.decayAlerts.updateStatus, {
      alertId,
      status: alert.status === "open" ? "acknowledged" : alert.status,
      diagnosisCause: diagnosis.cause,
      diagnosisNotes: diagnosis.notes,
    });

    return NextResponse.json(diagnosis);
  } catch (err) {
    console.error("[diagnose/POST]", err);
    return NextResponse.json(
      { error: "Diagnosis failed" },
      { status: 500 }
    );
  }
}
