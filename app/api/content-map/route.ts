import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  clusterGaps,
  funnelGaps,
  intentGaps,
  archetypeGaps,
  freshnessGaps,
  aeoGaps,
  cannibalizationGaps,
  computeOpportunities,
} from "@/lib/gap-analysis";
import type { ClusterBubble, ContentMapData } from "@/types/content-map";

export const runtime = "nodejs";

const STALE_BLOG_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const CLUSTER_ANALYSIS_LIMIT = 200;
const KEYWORD_ANALYSIS_LIMIT = 2000;
const BLOG_ANALYSIS_LIMIT = 300;

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`content-map:${userId}`, { limit: 30, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
        },
      }
    );
  }

  const convex = await getAuthedConvexClient();

  // 1. Workspace
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    const empty: ContentMapData = {
      clusters: [],
      gaps: [],
      opportunities: [],
      summary: { totalBlogs: 0, totalKeywords: 0, totalClusters: 0, coveredKeywords: 0, overallHealth: 0 },
      analysis: {
        blogsAnalyzed: 0,
        blogLimit: BLOG_ANALYSIS_LIMIT,
        blogsMayBeTruncated: false,
        keywordsAnalyzed: 0,
        keywordLimit: KEYWORD_ANALYSIS_LIMIT,
        keywordsMayBeTruncated: false,
        clustersAnalyzed: 0,
        clusterLimit: CLUSTER_ANALYSIS_LIMIT,
        clustersMayBeTruncated: false,
      },
    };
    return NextResponse.json(empty);
  }

  const workspaceId = workspace._id;

  // 2. Parallel data fetch
  const [clusters, keywords, blogs] = await Promise.all([
    convex.query(api.topicClusters.listByWorkspace, { workspaceId }),
    convex.query(api.keywords.listAllByWorkspace, { workspaceId }),
    convex.query(api.blogs.listByWorkspaceId, { workspaceId }),
  ]);

  // 3. Build ClusterBubble array
  const COVERED_STATUSES = new Set(["written", "published", "ranking"]);
  const staleCutoff = Date.now() - STALE_BLOG_AGE_MS;

  const clusterBubbles: ClusterBubble[] = clusters.map((cluster) => {
    const clusterKws = keywords.filter((k) => k.clusterId === cluster._id);
    const coveredKws = clusterKws.filter((k) => COVERED_STATUSES.has(k.status));

    // Find blogs whose focusKeyword matches any keyword in this cluster
    const clusterKwSet = new Set(clusterKws.map((k) => k.keyword.toLowerCase()));
    const clusterBlogs = blogs.filter(
      (b) => b.focusKeyword && clusterKwSet.has(b.focusKeyword.toLowerCase())
    );

    const seoScores = clusterBlogs
      .map((b) => b.seoScore)
      .filter((s): s is number => typeof s === "number");
    const avgSeoScore =
      seoScores.length > 0
        ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length)
        : null;

    // Dominant archetype
    const archetypeCounts: Record<string, number> = {};
    for (const b of clusterBlogs) {
      archetypeCounts[b.archetype] = (archetypeCounts[b.archetype] ?? 0) + 1;
    }
    const dominantArchetype =
      Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Dominant buyer stage
    const stageCounts: Record<string, number> = {};
    for (const k of clusterKws) {
      if (k.buyerStage) {
        stageCounts[k.buyerStage] = (stageCounts[k.buyerStage] ?? 0) + 1;
      }
    }
    const dominantBuyerStage =
      Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const coverageRatio =
      clusterKws.length > 0 ? coveredKws.length / clusterKws.length : 0;
    const hasStaleLowSeoBlog = clusterBlogs.some(
      (blog) =>
        blog.updatedAt < staleCutoff &&
        (blog.seoScore === undefined || blog.seoScore === null || blog.seoScore < 70),
    );

    const seenFocusKeywords = new Set<string>();
    let hasDuplicateFocusKeyword = false;
    for (const blog of clusterBlogs) {
      const normalized = blog.focusKeyword?.trim().toLowerCase();
      if (!normalized) continue;
      if (seenFocusKeywords.has(normalized)) {
        hasDuplicateFocusKeyword = true;
        break;
      }
      seenFocusKeywords.add(normalized);
    }

    let gapCount = 0;
    if (coverageRatio < 0.8) gapCount += 1;
    if (avgSeoScore !== null && avgSeoScore < 80) gapCount += 1;
    if (hasStaleLowSeoBlog) gapCount += 1;
    if (hasDuplicateFocusKeyword) gapCount += 1;

    return {
      id: cluster._id,
      name: cluster.name,
      pillarKeyword: cluster.pillarKeyword,
      blogCount: clusterBlogs.length,
      keywordCount: clusterKws.length,
      coveredCount: coveredKws.length,
      avgSeoScore,
      gapCount,
      dominantArchetype,
      dominantBuyerStage,
    };
  });

  // 4. Run all gap functions
  const gaps = [
    clusterGaps(clusters, keywords),
    funnelGaps(keywords),
    intentGaps(keywords),
    archetypeGaps(blogs),
    freshnessGaps(blogs),
    aeoGaps(blogs),
    cannibalizationGaps(keywords, blogs),
  ];

  // 5. Opportunities
  const opportunities = computeOpportunities(gaps, keywords);

  // 6. Summary + overall health
  const coveredKeywords = keywords.filter((k) =>
    COVERED_STATUSES.has(k.status)
  ).length;

  const coverageScore =
    keywords.length > 0
      ? Math.round((coveredKeywords / keywords.length) * 100)
      : 0;

  const allSeoScores = blogs
    .map((b) => b.seoScore)
    .filter((s): s is number => typeof s === "number");
  const avgSeoScore =
    allSeoScores.length > 0
      ? Math.round(allSeoScores.reduce((a, b) => a + b, 0) / allSeoScores.length)
      : 0;

  const freshnessGap = gaps.find((g) => g.type === "freshness")!;
  const freshnessScore = Math.max(0, 100 - freshnessGap.percentage);

  const aeoGap = gaps.find((g) => g.type === "aeo")!;
  const aeoScore = Math.max(0, 100 - aeoGap.percentage);

  const overallHealth = Math.round(
    coverageScore * 0.4 +
      avgSeoScore * 0.3 +
      freshnessScore * 0.2 +
      aeoScore * 0.1
  );

  const result: ContentMapData = {
    clusters: clusterBubbles,
    gaps,
    opportunities,
    summary: {
      totalBlogs: blogs.length,
      totalKeywords: keywords.length,
      totalClusters: clusters.length,
      coveredKeywords,
      overallHealth,
    },
    analysis: {
      blogsAnalyzed: blogs.length,
      blogLimit: BLOG_ANALYSIS_LIMIT,
      blogsMayBeTruncated: blogs.length >= BLOG_ANALYSIS_LIMIT,
      keywordsAnalyzed: keywords.length,
      keywordLimit: KEYWORD_ANALYSIS_LIMIT,
      keywordsMayBeTruncated: keywords.length >= KEYWORD_ANALYSIS_LIMIT,
      clustersAnalyzed: clusters.length,
      clusterLimit: CLUSTER_ANALYSIS_LIMIT,
      clustersMayBeTruncated: clusters.length >= CLUSTER_ANALYSIS_LIMIT,
    },
  };

  return NextResponse.json(result);
}
