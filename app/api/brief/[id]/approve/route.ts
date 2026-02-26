import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_BRIEF_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { hasConvexErrorCode, isConvexAppError } from "@/lib/convex-error";
import { isBriefDataPatch } from "@/lib/brief/validate";

// PUT /api/brief/[id]/approve — approve a brief with optional modifications
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`brief-approve:${userId}`, { limit: 60, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await params;
  const briefId = parseConvexId(id, "contentBriefs");
  if (!briefId) return NextResponse.json({ error: "Invalid brief id" }, { status: 400 });

  let body: { modifications?: unknown } = {};
  try { body = await request.json(); } catch { /* modifications optional */ }
  if (
    body.modifications !== undefined &&
    (typeof body.modifications !== "object" || body.modifications === null || Array.isArray(body.modifications))
  ) {
    return NextResponse.json({ error: "modifications must be an object" }, { status: 400 });
  }
  if (body.modifications !== undefined && !isBriefDataPatch(body.modifications)) {
    return NextResponse.json({ error: "Invalid modifications payload" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.contentBriefs.approve, {
      briefId,
      modifications: body.modifications,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isConvexAppError(err, ERR_BRIEF_NOT_FOUND)) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[brief/[id]/approve/PUT] error:", err);
    return NextResponse.json({ error: "Failed to approve brief" }, { status: 500 });
  }
}
