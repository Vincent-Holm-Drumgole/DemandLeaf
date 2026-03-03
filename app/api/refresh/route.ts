import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateRefreshBrief, generateRefreshedDraft } from "@/lib/refresh/generator";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`refresh:${userId}`, {
    limit: 5,
    windowSec: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const body = (await request.json()) as {
    blogId: string;
    alertId?: string;
    mode: "brief_only" | "full_draft";
  };

  if (!body.blogId || !body.mode) {
    return NextResponse.json(
      { error: "blogId and mode are required" },
      { status: 400 }
    );
  }

  const blogId = parseConvexId(body.blogId, "blogs");
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

  // Load diagnosis from the alert if provided
  let diagnosis = { cause: "content_freshness", notes: "General content refresh" };
  let alertId = body.alertId ? parseConvexId(body.alertId, "decayAlerts") : null;
  if (alertId) {
    const alert = await convex.query(api.decayAlerts.getById, { alertId });
    if (alert?.diagnosisCause) {
      diagnosis = {
        cause: alert.diagnosisCause,
        notes: alert.diagnosisNotes ?? "",
      };
    }
  }

  // Get the latest rank snapshot for currentPosition
  const snapshots = await convex.query(api.rankSnapshots.getSnapshotsForBlog, {
    blogId,
    limit: 1,
  });
  const currentPosition = snapshots[0]?.position ?? null;

  try {
    // Generate refresh brief
    const briefData = await generateRefreshBrief(
      convex,
      {
        title: blog.title,
        content: blog.content,
        focusKeyword: blog.focusKeyword ?? "",
        wordCount: blog.wordCount ?? 0,
        publishedAt: blog.publishedAt ?? undefined,
      },
      diagnosis,
      currentPosition,
      ""
    );

    // Create refresh record once we have typed brief data
    const refreshId = await convex.mutation(api.refreshHistory.create, {
      workspaceId: workspace._id,
      blogId,
      alertId: alertId ?? undefined,
      briefData,
      status: body.mode === "brief_only" ? "completed" : "in_progress",
    });

    let refreshedContent: string | undefined;
    if (body.mode === "full_draft") {
      // Load voice profile for draft generation
      const voiceProfile = await convex.query(api.voiceProfiles.getByWorkspace, {
        workspaceId: workspace._id,
      });

      const neverSayTerms = await convex.query(api.neverSayList.listByWorkspace, {
        workspaceId: workspace._id,
      });

      refreshedContent = await generateRefreshedDraft(
        { content: blog.content },
        briefData,
        voiceProfile?.voiceDescription ?? "",
        neverSayTerms.map((t: { term: string }) => t.term)
      );

      await convex.mutation(api.refreshHistory.updateContent, {
        refreshId,
        refreshedContent,
        status: "completed",
      });
    }

    // Update alert status if provided
    if (alertId) {
      await convex.mutation(api.decayAlerts.updateStatus, {
        alertId,
        status: "refreshing",
        refreshHistoryId: refreshId,
      });
    }

    return NextResponse.json({
      refreshId,
      briefData,
      refreshedContent: refreshedContent ?? null,
    });
  } catch (err) {
    console.error("[refresh/POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
