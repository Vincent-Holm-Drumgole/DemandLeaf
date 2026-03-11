import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_REVIEW_COMMENT_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";

interface RouteParams {
  params: Promise<{ id: string; commentId: string }>;
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams,
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`review-comment-action:${userId}`, { limit: 60, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const params = await context.params;
  const commentId = parseConvexId(params.commentId, "reviewComments");
  if (!commentId) {
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  let body: { action: string; accept?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();

    if (body.action === "resolve") {
      await convex.mutation(api.reviews.resolveComment, { commentId });
    } else if (body.action === "resolve_suggestion") {
      if (typeof body.accept !== "boolean") {
        return NextResponse.json({ error: "accept must be a boolean" }, { status: 400 });
      }
      await convex.mutation(api.reviews.resolveSuggestion, { commentId, accept: body.accept });
    } else {
      return NextResponse.json({ error: "action must be 'resolve' or 'resolve_suggestion'" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_REVIEW_COMMENT_NOT_FOUND)) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[blog/[id]/comments/[commentId]/PATCH] error:", err);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}
