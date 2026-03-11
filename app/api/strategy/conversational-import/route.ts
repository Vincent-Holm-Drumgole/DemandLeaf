import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { executeStrategyImport, type ImportPayload } from "@/lib/strategy/import";

export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-import:${userId}`, { limit: 3, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: ImportPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.strategyName || !body.seedKeywords?.length) {
    return NextResponse.json({ error: "strategyName and seedKeywords are required" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex, request);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const { strategyId, results } = await executeStrategyImport(convex, workspace._id, body);
    return NextResponse.json({ success: true, strategyId, results }, { status: 200 });
  } catch (err) {
    console.error("[strategy/conversational-import] error:", err);
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
