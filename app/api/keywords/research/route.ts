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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`keywords-research:${userId}`, { limit: 10, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: { strategyId?: string; seeds?: string[]; competitorDomains?: string[] };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { strategyId, seeds, competitorDomains } = body;

  if (!strategyId) return NextResponse.json({ error: "strategyId is required" }, { status: 400 });
  const strategyIdTyped = parseConvexId(strategyId, "strategies");
  if (!strategyIdTyped) return NextResponse.json({ error: "Invalid strategyId" }, { status: 400 });
  if (!Array.isArray(seeds) || seeds.length === 0 || seeds.length > 10) {
    return NextResponse.json({ error: "seeds must be an array of 1–10 strings" }, { status: 400 });
  }
  const cleanSeeds = seeds
    .filter((seed): seed is string => typeof seed === "string")
    .map((seed) => seed.trim())
    .filter((seed) => seed.length > 0 && seed.length <= 120)
    .slice(0, 10);
  if (cleanSeeds.length === 0) {
    return NextResponse.json({ error: "At least one valid seed is required" }, { status: 400 });
  }
  const cleanDomains = Array.isArray(competitorDomains)
    ? competitorDomains
        .filter((domain): domain is string => typeof domain === "string")
        .map((domain) => domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
        .filter((domain) => domain.length > 0 && domain.length <= 255)
        .slice(0, 5)
    : [];

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const strategy = await convex.query(api.strategies.getByIdInternal, {
      strategyId: strategyIdTyped,
      workspaceId: workspace._id,
    });
    if (!strategy) return NextResponse.json({ error: "Strategy not found" }, { status: 404 });

    // 1. Discover keywords from seeds + competitor domains
    const discovered = await discoverKeywords(convex, cleanSeeds, cleanDomains);

    if (discovered.length === 0) {
      return NextResponse.json({ keywords: [], count: 0 });
    }

    const keywordStrings = discovered.slice(0, 200);

    // 2. Fetch keyword metrics
    const metrics = await getKeywordData(convex, keywordStrings);
    const metricsMap = new Map(metrics.map((m) => [m.keyword.toLowerCase(), m]));

    // 3. Classify intents
    const intents = await classifyIntents(keywordStrings);

    // 4. Score opportunities + bulk create in Convex
    const ids: FunctionReturnType<typeof api.keywords.bulkCreate> = await convex.mutation(
      api.keywords.bulkCreate,
      {
      workspaceId: workspace._id,
      strategyId: strategyIdTyped,
      keywords: keywordStrings,
      }
    );

    // 5. Update metrics for each keyword in parallel
    await Promise.allSettled(
      ids.map(async (id, i: number) => {
        const kw = keywordStrings[i].toLowerCase();
        const metric = metricsMap.get(kw) ?? { searchVolume: 0, keywordDifficulty: 0, cpc: 0 };
        const intent = intents.get(kw) ?? "informational";
        const score = scoreOpportunity(metric.searchVolume, metric.keywordDifficulty, intent);
        await convex.mutation(api.keywords.updateMetrics, {
          keywordId: id,
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
    console.error("[keywords/research/POST] error:", err);
    return NextResponse.json({ error: "Failed to run keyword research" }, { status: 500 });
  }
}
