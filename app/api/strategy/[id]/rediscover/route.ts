import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { discoverKeywords } from "@/lib/strategy/keyword-discovery";
import { getKeywordData } from "@/lib/seo-data";
import { classifyIntents } from "@/lib/strategy/intent-classifier";
import { scoreOpportunity } from "@/lib/strategy/opportunity-scorer";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import type { FunctionReturnType } from "convex/server";
import { hasConvexErrorCode } from "@/lib/convex-error";
import type { SearchIntent } from "@/types";

// POST /api/strategy/[id]/rediscover — clear old data + re-run discovery
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-rediscover:${userId}`, { limit: 20, windowSec: 3600 });
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

    const strategy = await convex.query(api.strategies.getByIdInternal, {
      strategyId,
      workspaceId: workspace._id,
    });

    // Clear old discovery data
    await convex.mutation(api.strategies.clearDiscoveryData, { strategyId });

    // Re-run discovery pipeline
    const discovered = await discoverKeywords(convex, strategy.seedKeywords, []);

    if (discovered.length === 0) {
      return NextResponse.json({ keywords: [], count: 0 });
    }

    const keywordStrings = discovered.slice(0, 200);
    let metricsMap = new Map<string, { searchVolume: number; keywordDifficulty: number; cpc: number }>();
    try {
      const metrics = await getKeywordData(convex, keywordStrings);
      metricsMap = new Map(metrics.map((m) => [m.keyword.toLowerCase(), m]));
    } catch (metricsErr) {
      console.warn("[strategy/[id]/rediscover/POST] keyword metrics unavailable:", metricsErr);
    }

    let intents = new Map<string, SearchIntent>();
    try {
      intents = await classifyIntents(keywordStrings);
    } catch (intentErr) {
      console.warn("[strategy/[id]/rediscover/POST] intent classification unavailable:", intentErr);
    }

    const ids: FunctionReturnType<typeof api.keywords.bulkCreate> = await convex.mutation(
      api.keywords.bulkCreate,
      {
        workspaceId: workspace._id,
        strategyId,
        keywords: keywordStrings,
      }
    );

    const BATCH_SIZE = 25;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (rawId, j) => {
          const kw = keywordStrings[i + j].toLowerCase();
          const metric = metricsMap.get(kw) ?? { searchVolume: 0, keywordDifficulty: 0, cpc: 0 };
          const intent = intents.get(kw) ?? "informational";
          const score = scoreOpportunity(metric.searchVolume, metric.keywordDifficulty, intent);
          await convex.mutation(api.keywords.updateMetrics, {
            keywordId: rawId,
            searchVolume: metric.searchVolume,
            keywordDifficulty: metric.keywordDifficulty,
            cpc: metric.cpc,
            opportunityScore: score,
            searchIntent: intent,
          });
        })
      );
    }

    return NextResponse.json({
      keywords: keywordStrings,
      count: keywordStrings.length,
    }, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[strategy/[id]/rediscover/POST] error:", err);
    return NextResponse.json({ error: "Failed to re-run keyword discovery" }, { status: 500 });
  }
}
