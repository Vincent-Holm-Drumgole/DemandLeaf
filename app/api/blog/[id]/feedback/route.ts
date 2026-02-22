import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { FeedbackRequest } from "@/types";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
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
      : null;

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

  const blogExists = await prisma.blog.findUnique({
    where: { id: blogId },
    select: { id: true },
  });

  if (!blogExists) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  const created = await prisma.blogFeedback.create({
    data: {
      blogId,
      paragraphIndex,
      feedback,
      comment,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      blogId: created.blogId,
      paragraphIndex: created.paragraphIndex,
      feedback: created.feedback,
      comment: created.comment,
      createdAt: created.createdAt,
    },
    { status: 201 }
  );
}
