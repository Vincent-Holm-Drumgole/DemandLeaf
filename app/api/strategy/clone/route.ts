import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { hasConvexErrorCode } from "@/lib/convex-error";

// POST /api/strategy/clone — duplicate a strategy
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-clone:${userId}`, { limit: 5, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: { strategyId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const strategyId = body.strategyId ? parseConvexId(body.strategyId, "strategies") : null;
  if (!strategyId) return NextResponse.json({ error: "Invalid strategy id" }, { status: 400 });

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const source = await convex.query(api.strategies.getByIdInternal, {
      strategyId,
      workspaceId: workspace._id,
    });

    const newId = await convex.mutation(api.strategies.create, {
      workspaceId: workspace._id,
      name: `${source.name} (copy)`,
      businessOutcomes: source.businessOutcomes,
      targetAudience: source.targetAudience,
      seedKeywords: source.seedKeywords,
    });

    return NextResponse.json({ strategyId: newId }, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_STRATEGY_NOT_FOUND)) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[strategy/clone/POST] error:", err);
    return NextResponse.json({ error: "Failed to clone strategy" }, { status: 500 });
  }
}
