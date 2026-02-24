import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { FeedbackRequest } from "@/types";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERR_BLOG_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`feedback:${userId}`, { limit: 60, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
      },
    );
  }

  const params = await context.params;
  const blogId = parseConvexId(params.id, "blogs");
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  let body: FeedbackRequest;
  try {
    body = (await request.json()) as FeedbackRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const paragraphIndex = Number(body.paragraphIndex);
  const feedback = body.feedback;
  const comment =
    typeof body.comment === "string" && body.comment.trim().length > 0
      ? body.comment.trim()
      : undefined;

  if (!Number.isInteger(paragraphIndex) || paragraphIndex < 0) {
    return NextResponse.json(
      { error: "paragraphIndex must be a non-negative integer" },
      { status: 400 }
    );
  }

  if (feedback !== "positive" && feedback !== "negative") {
    return NextResponse.json(
      { error: "feedback must be 'positive' or 'negative'" },
      { status: 400 }
    );
  }

  const convex = await getAuthedConvexClient();
  let createdId: string;
  let createdAt: number;
  try {
    const created = await convex.mutation(api.feedback.create, {
      blogId,
      paragraphIndex,
      feedback,
      comment,
    });
    createdId = created.id;
    createdAt = created.createdAt;
  } catch (err) {
    if (err instanceof Error && err.message.includes(ERR_BLOG_NOT_FOUND)) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message.includes(ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[blog/[id]/feedback/POST] mutation error:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: createdId,
      blogId: params.id,
      paragraphIndex,
      feedback,
      comment: comment ?? null,
      createdAt: new Date(createdAt).toISOString(),
    },
    { status: 201 }
  );
}
