import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_BRIEF_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";

// PUT /api/brief/[id]/reject — reject a brief
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`brief-reject:${userId}`, { limit: 60, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await params;
  const briefId = parseConvexId(id, "contentBriefs");
  if (!briefId) return NextResponse.json({ error: "Invalid brief id" }, { status: 400 });

  try {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.contentBriefs.reject, { briefId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes(ERR_BRIEF_NOT_FOUND)) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message.includes(ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[brief/[id]/reject/PUT] error:", err);
    return NextResponse.json({ error: "Failed to reject brief" }, { status: 500 });
  }
}
