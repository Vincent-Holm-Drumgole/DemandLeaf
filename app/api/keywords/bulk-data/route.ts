import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { getKeywordData } from "@/lib/seo-data";
import { classifyIntents } from "@/lib/strategy/intent-classifier";
import { scoreOpportunity } from "@/lib/strategy/opportunity-scorer";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`keywords-bulk-data:${userId}`, { limit: 30, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: { keywords?: string[] };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json({ error: "keywords array is required" }, { status: 400 });
  }
  if (body.keywords.length > 200) {
    return NextResponse.json({ error: "At most 200 keywords per request" }, { status: 400 });
  }
  const keywords = body.keywords
    .filter((keyword): keyword is string => typeof keyword === "string")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0 && keyword.length <= 120);
  if (keywords.length === 0) {
    return NextResponse.json({ error: "At least one valid keyword is required" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const [metrics, intents] = await Promise.all([
      getKeywordData(convex, keywords),
      classifyIntents(keywords),
    ]);

    const metricsMap = new Map(metrics.map((m) => [m.keyword.toLowerCase(), m]));
    const results = keywords.map((kw) => {
      const m = metricsMap.get(kw.toLowerCase()) ?? { keyword: kw, searchVolume: 0, keywordDifficulty: 0, cpc: 0 };
      const intent = intents.get(kw.toLowerCase()) ?? "informational";
      return {
        keyword: m.keyword,
        searchVolume: m.searchVolume,
        keywordDifficulty: m.keywordDifficulty,
        cpc: m.cpc,
        searchIntent: intent,
        opportunityScore: scoreOpportunity(m.searchVolume, m.keywordDifficulty, intent),
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[keywords/bulk-data/POST] error:", err);
    return NextResponse.json({ error: "Failed to fetch keyword data" }, { status: 500 });
  }
}
