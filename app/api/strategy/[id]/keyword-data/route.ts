import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { enrichKeywordRecords } from "@/lib/strategy/keyword-enrichment";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-keyword-data:${userId}`, { limit: 20, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await params;
  const strategyId = parseConvexId(id, "strategies");
  if (!strategyId) return NextResponse.json({ error: "Invalid strategy id" }, { status: 400 });

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    await convex.query(api.strategies.getByIdInternal, {
      strategyId,
      workspaceId: workspace._id,
    });

    const keywords = await convex.query(api.keywords.listByStrategy, { strategyId });
    if (keywords.length === 0) {
      return NextResponse.json({ updated: 0, failures: 0, count: 0 });
    }

    try {
      const cacheKeys = keywords.map((keyword) => `keyword:${keyword.keyword.toLowerCase()}`);
      for (let i = 0; i < cacheKeys.length; i += 50) {
        await convex.mutation(api.seoDataCache.invalidateKeys, {
          cacheKeys: cacheKeys.slice(i, i + 50),
        });
      }
    } catch (cacheErr) {
      console.warn("[strategy/[id]/keyword-data/POST] cache invalidation failed:", cacheErr);
    }

    const result = await enrichKeywordRecords(
      convex,
      keywords.map((keyword) => ({
        keywordId: keyword._id,
        keyword: keyword.keyword,
      })),
    );

    return NextResponse.json({
      count: keywords.length,
      updated: result.updated,
      failures: result.failures,
    });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[strategy/[id]/keyword-data/POST] error:", err);
    return NextResponse.json({ error: "Failed to refresh keyword data" }, { status: 500 });
  }
}
