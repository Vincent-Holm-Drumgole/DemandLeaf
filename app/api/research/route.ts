import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const dashboard = await convex.query(api.research.listDashboard, {
    workspaceId: workspace._id,
  });

  return NextResponse.json({
    sources: dashboard.sources.map((source) => ({
      id: source._id,
      workspaceId: source.workspaceId,
      label: source.label,
      type: source.type,
      url: source.url,
      keywords: source.keywords,
      status: source.status,
      lastCheckedAt: source.lastCheckedAt ?? null,
      lastSuccessAt: source.lastSuccessAt ?? null,
      errorMessage: source.errorMessage ?? null,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    })),
    briefs: dashboard.briefs.map((brief) => ({
      id: brief._id,
      workspaceId: brief.workspaceId,
      sourceId: brief.sourceId ?? null,
      kind: brief.kind,
      status: brief.status,
      title: brief.title,
      summary: brief.summary,
      whyItMatters: brief.whyItMatters,
      suggestedAngle: brief.suggestedAngle,
      sourceUrls: brief.sourceUrls,
      sourceNames: brief.sourceNames,
      keywords: brief.keywords,
      relevanceScore: brief.relevanceScore,
      contentTrack: brief.contentTrack,
      createdAt: brief.createdAt,
      updatedAt: brief.updatedAt,
    })),
    competitorArticles: dashboard.competitorArticles.map((article) => ({
      id: article._id,
      workspaceId: article.workspaceId,
      trackingId: article.trackingId ?? null,
      domain: article.domain,
      url: article.url,
      title: article.title,
      summary: article.summary,
      angle: article.angle,
      keywords: article.keywords,
      publishedAt: article.publishedAt ?? null,
      scrapedAt: article.scrapedAt,
    })),
  });
}
