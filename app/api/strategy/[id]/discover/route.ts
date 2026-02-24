import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { discoverKeywords } from "@/lib/strategy/keyword-discovery";
import { getKeywordData } from "@/lib/seo-data";
import { classifyIntents } from "@/lib/strategy/intent-classifier";
import { scoreOpportunity } from "@/lib/strategy/opportunity-scorer";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import type { FunctionReturnType } from "convex/server";

// POST /api/strategy/[id]/discover — full keyword discovery pipeline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-discover:${userId}`, { limit: 5, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await params;
  const strategyId = parseConvexId(id, "strategies");
  if (!strategyId) return NextResponse.json({ error: "Invalid strategy id" }, { status: 400 });

  let body: { competitorDomains?: string[] } = {};
  try { body = await request.json(); } catch { /* body is optional */ }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const strategy = await convex.query(api.strategies.getByIdInternal, {
      strategyId,
      workspaceId: workspace._id,
    });

    const domains = Array.isArray(body.competitorDomains)
      ? body.competitorDomains
          .filter((domain): domain is string => typeof domain === "string")
          .map((domain) => domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
          .filter((domain) => domain.length > 0 && domain.length <= 255)
          .slice(0, 5)
      : [];

    // 1. Discover keywords from strategy's seed keywords + optional competitor domains
    const discovered = await discoverKeywords(convex, strategy.seedKeywords, domains);

    if (discovered.length === 0) {
      return NextResponse.json({ keywords: [], count: 0 });
    }

    // 2. Cap and fetch keyword metrics
    const keywordStrings = discovered.slice(0, 200);
    const metrics = await getKeywordData(convex, keywordStrings);
    const metricsMap = new Map(metrics.map((m) => [m.keyword.toLowerCase(), m]));

    // 3. Classify intents
    const intents = await classifyIntents(keywordStrings);

    // 4. Bulk create keywords in Convex (cap at 200)
    const ids: FunctionReturnType<typeof api.keywords.bulkCreate> = await convex.mutation(
      api.keywords.bulkCreate,
      {
      workspaceId: workspace._id,
      strategyId,
      keywords: keywordStrings,
      }
    );

    // 5. Update metrics for each keyword
    await Promise.allSettled(
      ids.map(async (rawId, i: number) => {
        const kw = keywordStrings[i].toLowerCase();
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

    return NextResponse.json({ keywords: keywordStrings, count: keywordStrings.length }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes(ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message.includes(ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[strategy/[id]/discover/POST] error:", err);
    return NextResponse.json({ error: "Failed to run keyword discovery" }, { status: 500 });
  }
}
