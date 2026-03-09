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

export const maxDuration = 120;

// POST /api/strategy/[id]/discover — full keyword discovery pipeline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-discover:${userId}`, { limit: 20, windowSec: 3600 });
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
  const rawBody = await request.text();
  if (rawBody.trim().length > 0) {
    try {
      body = JSON.parse(rawBody) as { competitorDomains?: string[] };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const strategy = await convex.query(api.strategies.getByIdInternal, {
      strategyId,
      workspaceId: workspace._id,
    });

    const domains = Array.isArray(body.competitorDomains)
      ? Array.from(
          new Set(
            body.competitorDomains
              .filter((domain): domain is string => typeof domain === "string")
              .map((domain) => normalizeDomain(domain))
              .filter((domain): domain is string => domain !== null),
          ),
        ).slice(0, 5)
      : [];

    // 1. Discover keywords from strategy's seed keywords + optional competitor domains
    const discovered = await discoverKeywords(convex, strategy.seedKeywords, domains);

    if (discovered.length === 0) {
      return NextResponse.json({ keywords: [], count: 0 });
    }

    // 2. Cap and fetch keyword metrics (graceful if DataForSEO unavailable)
    const keywordStrings = discovered.slice(0, 200);
    let metricsMap = new Map<string, { searchVolume: number; keywordDifficulty: number; cpc: number }>();
    try {
      const metrics = await getKeywordData(convex, keywordStrings);
      metricsMap = new Map(metrics.map((m) => [m.keyword.toLowerCase(), m]));
    } catch (metricsErr) {
      console.warn("[strategy/[id]/discover/POST] keyword metrics unavailable:", metricsErr);
    }

    // 3. Classify intents (graceful if AI unavailable)
    let intents = new Map<string, SearchIntent>();
    try {
      intents = await classifyIntents(keywordStrings);
    } catch (intentErr) {
      console.warn("[strategy/[id]/discover/POST] intent classification unavailable:", intentErr);
    }

    // 4. Bulk create keywords in Convex (cap at 200)
    const ids: FunctionReturnType<typeof api.keywords.bulkCreate> = await convex.mutation(
      api.keywords.bulkCreate,
      {
      workspaceId: workspace._id,
      strategyId,
      keywords: keywordStrings,
      }
    );

    // 5. Update metrics in batches to avoid overwhelming Convex with concurrent mutations
    const BATCH_SIZE = 25;
    let metricFailures = 0;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
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
      const batchFailures = batchResults.filter((r) => r.status === "rejected");
      metricFailures += batchFailures.length;
    }
    if (metricFailures > 0) {
      console.error(
        `[strategy/[id]/discover/POST] ${metricFailures}/${ids.length} metric update(s) failed`,
      );
    }

    return NextResponse.json({
      keywords: keywordStrings,
      count: keywordStrings.length,
      ...(metricFailures > 0 && { partialFailures: metricFailures }),
    }, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[strategy/[id]/discover/POST] error:", err);
    return NextResponse.json({ error: "Failed to run keyword discovery" }, { status: 500 });
  }
}

function normalizeDomain(raw: string): string | null {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^\.+|\.+$/g, "");
  if (normalized.length === 0 || normalized.length > 255) return null;
  if (normalized === "localhost") return null;
  const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  return DOMAIN_REGEX.test(normalized) ? normalized : null;
}
