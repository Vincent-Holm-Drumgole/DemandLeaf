import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";

// GET /api/strategy/[id] — strategy + keywords + clusters
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-get:${userId}`, { limit: 60, windowSec: 60 });
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
    const workspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const [strategy, keywords, clusters] = await Promise.all([
      convex.query(api.strategies.getByIdInternal, { strategyId, workspaceId: workspace._id }),
      convex.query(api.keywords.listByStrategy, { strategyId }),
      convex.query(api.topicClusters.listByStrategy, { strategyId }),
    ]);

    return NextResponse.json({ strategy, keywords, clusters });
  } catch (err) {
    if (err instanceof Error && err.message.includes(ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message.includes(ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[strategy/[id]/GET] error:", err);
    return NextResponse.json({ error: "Failed to load strategy" }, { status: 500 });
  }
}

// PATCH /api/strategy/[id] — update name / outcomes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-update:${userId}`, { limit: 20, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await params;
  const strategyId = parseConvexId(id, "strategies");
  if (!strategyId) return NextResponse.json({ error: "Invalid strategy id" }, { status: 400 });

  let body: { name?: string; businessOutcomes?: string; targetAudience?: string; seedKeywords?: string[] };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name && !body.businessOutcomes && !body.targetAudience && !body.seedKeywords) {
    return NextResponse.json({ error: "At least one field to update is required" }, { status: 400 });
  }
  if (body.seedKeywords && body.seedKeywords.length > 20) {
    return NextResponse.json({ error: "At most 20 seed keywords per strategy" }, { status: 400 });
  }
  const cleanSeedKeywords = body.seedKeywords
    ? body.seedKeywords
        .filter((seed): seed is string => typeof seed === "string")
        .map((seed) => seed.trim())
        .filter((seed) => seed.length > 0 && seed.length <= 120)
        .slice(0, 20)
    : undefined;

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    // Verify ownership before update
    await convex.query(api.strategies.getByIdInternal, { strategyId, workspaceId: workspace._id });

    await convex.mutation(api.strategies.update, {
      strategyId,
      name: body.name?.trim(),
      businessOutcomes: body.businessOutcomes?.trim(),
      targetAudience: body.targetAudience?.trim(),
      seedKeywords: cleanSeedKeywords,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes(ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message.includes(ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[strategy/[id]/PATCH] error:", err);
    return NextResponse.json({ error: "Failed to update strategy" }, { status: 500 });
  }
}
