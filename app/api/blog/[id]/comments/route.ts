import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_BLOG_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteParams,
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`review-comment:${userId}`, { limit: 60, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const params = await context.params;
  const blogId = parseConvexId(params.id, "blogs");
  if (!blogId) return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });

  let body: {
    anchorParagraphIndex: number;
    anchorText?: string;
    body: string;
    parentId?: string;
    suggestionOriginal?: string;
    suggestionReplacement?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  if (!Number.isInteger(body.anchorParagraphIndex) || body.anchorParagraphIndex < 0) {
    return NextResponse.json({ error: "anchorParagraphIndex must be a non-negative integer" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();

    const isSuggestion = body.suggestionOriginal && body.suggestionReplacement;

    let commentId: string;
    if (isSuggestion) {
      commentId = await convex.mutation(api.reviews.addSuggestion, {
        blogId,
        anchorParagraphIndex: body.anchorParagraphIndex,
        anchorText: body.anchorText,
        body: body.body,
        suggestionOriginal: body.suggestionOriginal!,
        suggestionReplacement: body.suggestionReplacement!,
      });
    } else {
      const parentId = body.parentId ? parseConvexId(body.parentId, "reviewComments") : undefined;
      commentId = await convex.mutation(api.reviews.addComment, {
        blogId,
        anchorParagraphIndex: body.anchorParagraphIndex,
        anchorText: body.anchorText,
        body: body.body,
        parentId: parentId ?? undefined,
      });
    }

    return NextResponse.json({ id: commentId }, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_BLOG_NOT_FOUND)) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[blog/[id]/comments/POST] error:", err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
