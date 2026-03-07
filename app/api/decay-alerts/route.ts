import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`decay-alerts:${userId}`, {
    limit: 60,
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
    const workspace = await requireRequestWorkspace(convex, request);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const alerts = await convex.query(api.decayAlerts.listByWorkspace, {
      workspaceId: workspace._id,
    });

    const uniqueBlogIds = Array.from(new Set(alerts.map((alert) => alert.blogId)));
    const blogDocs = await Promise.all(
      uniqueBlogIds.map((blogId) =>
        convex.query(api.blogs.getById, { blogId }).catch(() => null)
      )
    );
    const blogTitleMap = new Map(
      uniqueBlogIds.map((blogId, index) => [
        blogId,
        blogDocs[index]?.title ?? "Untitled",
      ])
    );

    return NextResponse.json(
      alerts.map((alert) => ({
        id: alert._id,
        blogId: alert.blogId,
        blogTitle: blogTitleMap.get(alert.blogId) ?? "Untitled",
        alertType: alert.alertType,
        severity: alert.severity,
        triggeredAt: alert.triggeredAt,
        status: alert.status,
        baselineValue: alert.baselineValue,
        currentValue: alert.currentValue,
        deltaPercent: alert.deltaPercent,
        diagnosisCause: alert.diagnosisCause ?? null,
        diagnosisNotes: alert.diagnosisNotes ?? null,
      }))
    );
  } catch (err) {
    console.error("[decay-alerts/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
