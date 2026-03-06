import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { generateCalendar } from "@/lib/strategy/calendar-generator";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { hasConvexErrorCode } from "@/lib/convex-error";

// GET /api/calendar?month=YYYY-MM&strategyId=<id>
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`calendar-list:${userId}`, { limit: 60, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  // Optional ?month=YYYY-MM filter
  const monthParam = request.nextUrl.searchParams.get("month");
  const rawStrategyId = request.nextUrl.searchParams.get("strategyId");
  let fromDate: number | undefined;
  let toDate: number | undefined;
  let strategyId;

  if (monthParam) {
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
    }
    const [year, month] = monthParam.split("-").map(Number);
    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "month must be between 01 and 12" }, { status: 400 });
    }
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1); // first of next month
    fromDate = start.getTime();
    toDate = end.getTime() - 1;
  }
  if (rawStrategyId) {
    strategyId = parseConvexId(rawStrategyId, "strategies");
    if (!strategyId) {
      return NextResponse.json({ error: "Invalid strategyId" }, { status: 400 });
    }
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const items = await convex.query(api.contentCalendar.listByWorkspace, {
      workspaceId: workspace._id,
      strategyId,
      fromDate,
      toDate,
    });
    return NextResponse.json({ items });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[calendar/GET] error:", err);
    return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 });
  }
}

// POST /api/calendar — persist or refresh calendar for a strategy
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`calendar-generate:${userId}`, { limit: 20, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  let body: { strategyId?: string; startDate?: string; postsPerMonth?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.strategyId) {
    return NextResponse.json({ error: "strategyId is required" }, { status: 400 });
  }
  const strategyId = parseConvexId(body.strategyId, "strategies");
  if (!strategyId) {
    return NextResponse.json({ error: "Invalid strategyId" }, { status: 400 });
  }

  const postsPerMonth =
    typeof body.postsPerMonth === "number" && Number.isFinite(body.postsPerMonth)
      ? Math.min(Math.max(Math.floor(body.postsPerMonth), 1), 20)
      : 4;
  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    await convex.query(api.strategies.getByIdInternal, { strategyId, workspaceId: workspace._id });

    const [keywords, clusterDocs, briefs] = await Promise.all([
      convex.query(api.keywords.listByStrategy, { strategyId }),
      convex.query(api.topicClusters.listByStrategy, { strategyId }),
      convex.query(api.contentBriefs.listByWorkspace, { workspaceId: workspace._id }),
    ]);

    const clusterKeywordMap = new Map<string, string[]>();
    for (const keyword of keywords) {
      if (!keyword.clusterId) continue;
      const clusterKey = String(keyword.clusterId);
      const existing = clusterKeywordMap.get(clusterKey) ?? [];
      existing.push(keyword.keyword);
      clusterKeywordMap.set(clusterKey, existing);
    }

    const clusters = clusterDocs
      .map((cluster) => ({
        name: cluster.name,
        pillarKeyword: cluster.pillarKeyword,
        keywords: clusterKeywordMap.get(String(cluster._id)) ?? [],
      }))
      .filter((cluster) => cluster.keywords.length > 0);

    if (clusters.length === 0) {
      return NextResponse.json(
        { error: "No clustered keywords found. Run clustering first." },
        { status: 422 },
      );
    }

    const keywordEntries = keywords.map((keyword) => ({
      keywordId: String(keyword._id),
      keyword: keyword.keyword,
      opportunityScore: keyword.opportunityScore ?? 0,
    }));
    const calendarItems = generateCalendar(clusters, keywordEntries, startDate, postsPerMonth);

    const keywordIdByString = new Map(keywords.map((keyword) => [String(keyword._id), keyword._id]));

    const briefByKeyword = new Map<string, (typeof briefs)[number]["_id"]>();
    for (const brief of [...briefs].sort((a, b) => b.updatedAt - a.updatedAt)) {
      if (brief.status === "rejected") continue;
      const key = String(brief.keywordId);
      if (!briefByKeyword.has(key)) {
        briefByKeyword.set(key, brief._id);
      }
    }

    const persistedItems: Array<{
      keywordId: (typeof keywords)[number]["_id"];
      briefId?: (typeof briefs)[number]["_id"];
      scheduledDate: number;
      archetype: string;
      priority: number;
    }> = [];
    for (const item of calendarItems) {
      const keywordId = keywordIdByString.get(item.keywordId);
      if (!keywordId) continue;
      const briefId = briefByKeyword.get(item.keywordId);
      persistedItems.push({
        keywordId,
        briefId,
        scheduledDate: item.scheduledDate,
        archetype: item.archetype,
        priority: item.priority,
      });
    }

    await convex.mutation(api.contentCalendar.bulkCreate, {
      workspaceId: workspace._id,
      strategyId,
      items: persistedItems,
    });

    return NextResponse.json({
      items: calendarItems,
      count: calendarItems.length,
      persistedCount: persistedItems.length,
    }, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[calendar/POST] error:", err);
    return NextResponse.json({ error: "Failed to generate calendar" }, { status: 500 });
  }
}
