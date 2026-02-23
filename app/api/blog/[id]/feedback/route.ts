import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FeedbackRequest } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const params = await context.params;
  const blogId = params.id;
  if (!blogId) {
    return NextResponse.json({ error: "Blog ID is required" }, { status: 400 });
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

  const convex = getConvexClient();
  const { id: createdId, createdAt } = await convex.mutation(api.feedback.create, {
    blogId: blogId as Id<"blogs">,
    paragraphIndex,
    feedback,
    comment,
  });

  return NextResponse.json(
    {
      id: createdId,
      blogId,
      paragraphIndex,
      feedback,
      comment: comment ?? null,
      createdAt: new Date(createdAt).toISOString(),
    },
    { status: 201 }
  );
}
