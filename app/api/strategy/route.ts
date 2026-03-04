import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

// GET /api/strategy — list workspace strategies
export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-list:${userId}`, { limit: 60, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const strategies = await convex.query(api.strategies.listByWorkspace, {
      workspaceId: workspace._id,
    });
    return NextResponse.json({ strategies });
  } catch (err) {
    console.error("[strategy/GET] error:", err);
    return NextResponse.json({ error: "Failed to list strategies" }, { status: 500 });
  }
}

// POST /api/strategy — create a new strategy
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-create:${userId}`, { limit: 10, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: { name?: string; businessOutcomes?: string; targetAudience?: string; seedKeywords?: string[] };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, businessOutcomes, targetAudience, seedKeywords } = body;
  const safeTargetAudience = typeof targetAudience === "string" ? targetAudience.trim() : undefined;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!businessOutcomes || typeof businessOutcomes !== "string" || businessOutcomes.trim().length === 0) {
    return NextResponse.json({ error: "businessOutcomes is required" }, { status: 400 });
  }
  if (!Array.isArray(seedKeywords) || seedKeywords.length === 0) {
    return NextResponse.json({ error: "seedKeywords array is required" }, { status: 400 });
  }
  if (seedKeywords.length > 20) {
    return NextResponse.json({ error: "At most 20 seed keywords per strategy" }, { status: 400 });
  }
  const cleanSeedKeywords = seedKeywords
    .filter((seed): seed is string => typeof seed === "string")
    .map((seed) => seed.trim())
    .filter((seed) => seed.length > 0 && seed.length <= 120)
    .slice(0, 20);
  if (cleanSeedKeywords.length === 0) {
    return NextResponse.json({ error: "At least one valid seed keyword is required" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const strategyId = await convex.mutation(api.strategies.create, {
      workspaceId: workspace._id,
      name: name.trim(),
      businessOutcomes: businessOutcomes.trim(),
      targetAudience: safeTargetAudience,
      seedKeywords: cleanSeedKeywords,
    });

    return NextResponse.json({ strategyId }, { status: 201 });
  } catch (err) {
    console.error("[strategy/POST] error:", err);
    return NextResponse.json({ error: "Failed to create strategy" }, { status: 500 });
  }
}
