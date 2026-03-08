import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectCannibalization } from "@/lib/strategy/cannibalization-detector";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`cannibalization-check:${userId}`, { limit: 30, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: { keyword?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (keyword.length === 0) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }
  if (keyword.length > 120) {
    return NextResponse.json({ error: "keyword must be 120 characters or fewer" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const result = await detectCannibalization(convex, workspace._id, keyword);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cannibalization/check/POST] error:", err);
    return NextResponse.json({ error: "Failed to check cannibalization" }, { status: 500 });
  }
}
