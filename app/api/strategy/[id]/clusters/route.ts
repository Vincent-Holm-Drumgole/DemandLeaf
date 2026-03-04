import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { clusterKeywords } from "@/lib/strategy/topic-clusterer";
import { generateCalendar } from "@/lib/strategy/calendar-generator";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import type { FunctionReturnType } from "convex/server";
import { hasConvexErrorCode } from "@/lib/convex-error";

// POST /api/strategy/[id]/clusters — run topic clustering; store clusters + preview calendar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-clusters:${userId}`, { limit: 10, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await params;
  const strategyId = parseConvexId(id, "strategies");
  if (!strategyId) return NextResponse.json({ error: "Invalid strategy id" }, { status: 400 });

  let body: { startDate?: string; postsPerMonth?: number } = {};
  const rawBody = await request.text();
  if (rawBody.trim().length > 0) {
    try {
      body = JSON.parse(rawBody) as { startDate?: string; postsPerMonth?: number };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const postsPerMonth =
    typeof body.postsPerMonth === "number" && Number.isFinite(body.postsPerMonth) && body.postsPerMonth > 0
    ? Math.min(Math.floor(body.postsPerMonth), 20)
    : 4;
  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  if (isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    // Throws if strategy doesn't exist or user lacks access
    await convex.query(api.strategies.getByIdInternal, { strategyId, workspaceId: workspace._id });

    // 1. Load keywords for this strategy
    const keywords = await convex.query(api.keywords.listByStrategy, { strategyId });

    if (keywords.length === 0) {
      return NextResponse.json({ error: "No keywords found for this strategy. Run discovery first." }, { status: 422 });
    }

    // 2. Build input for clusterer (keyword + opportunityScore)
    const keywordsWithScores = keywords.map((kw) => ({
      keyword: kw.keyword,
      opportunityScore: kw.opportunityScore ?? 0,
    }));

    // 3. Run topic clustering
    const clusters = await clusterKeywords(keywordsWithScores);

    // 4. Store clusters in Convex
    const clusterIds: FunctionReturnType<typeof api.topicClusters.bulkCreate> = await convex.mutation(
      api.topicClusters.bulkCreate,
      {
      workspaceId: workspace._id,
      strategyId,
      clusters: clusters.map((c) => ({ name: c.name, pillarKeyword: c.pillarKeyword })),
      }
    );

    // 5. Update each keyword's clusterId
    const keywordByString = new Map(keywords.map((kw) => [kw.keyword, kw._id]));

    const assignResults = await Promise.allSettled(
      clusters.flatMap((cluster, clusterIndex) =>
        cluster.keywords.map(async (kw) => {
          const kwId = keywordByString.get(kw);
          if (!kwId) return;
          await convex.mutation(api.keywords.updateCluster, {
            keywordId: kwId,
            clusterId: clusterIds[clusterIndex],
          });
        })
      )
    );
    const assignFailures = assignResults.filter((r) => r.status === "rejected");
    if (assignFailures.length > 0) {
      console.error(
        `[strategy/[id]/clusters/POST] ${assignFailures.length} keyword-cluster assignment(s) failed`,
        assignFailures,
      );
    }

    // 6. Generate preview calendar (persistence happens in POST /api/calendar)
    const keywordEntries = keywords.map((kw) => ({
      keywordId: kw._id,
      keyword: kw.keyword,
      opportunityScore: kw.opportunityScore ?? 0,
    }));
    const calendarItems = generateCalendar(clusters, keywordEntries, startDate, postsPerMonth);

    return NextResponse.json({
      clusters: clusters.map((c, i) => ({ id: clusterIds[i], ...c })),
      calendarItems,
      count: clusters.length,
    }, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[strategy/[id]/clusters/POST] error:", err);
    return NextResponse.json({ error: "Failed to run topic clustering" }, { status: 500 });
  }
}
