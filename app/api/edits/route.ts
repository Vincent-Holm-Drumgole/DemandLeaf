import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_BLOG_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { hasConvexErrorCode } from "@/lib/convex-error";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate-limit per user: 50 edit records per hour
  const rateLimit = await checkRateLimit(`edits:${userId}`, { limit: 50, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many edit submissions" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: {
    blogId?: string;
    paragraphIndex?: number;
    originalText?: string;
    editedText?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { blogId, paragraphIndex, originalText, editedText } = body;

  if (!blogId || typeof blogId !== "string") {
    return NextResponse.json({ error: "blogId is required" }, { status: 400 });
  }
  const blogIdTyped = parseConvexId(blogId, "blogs");
  if (!blogIdTyped) {
    return NextResponse.json({ error: "Invalid blogId format" }, { status: 400 });
  }
  if (
    typeof paragraphIndex !== "number" ||
    !Number.isInteger(paragraphIndex) ||
    paragraphIndex < 0
  ) {
    return NextResponse.json({ error: "paragraphIndex must be a non-negative number" }, { status: 400 });
  }
  if (!originalText || typeof originalText !== "string") {
    return NextResponse.json({ error: "originalText is required" }, { status: 400 });
  }
  if (!editedText || typeof editedText !== "string") {
    return NextResponse.json({ error: "editedText is required" }, { status: 400 });
  }
  if (originalText.length > 10000 || editedText.length > 10000) {
    return NextResponse.json({ error: "Paragraph text must be 10,000 characters or less" }, { status: 400 });
  }

  const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();
  if (normalizeText(originalText) === normalizeText(editedText)) {
    return NextResponse.json({ success: true, skipped: true }, { status: 200 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const editId = await convex.mutation(api.blogEdits.recordEdit, {
      blogId: blogIdTyped,
      workspaceId: workspace._id,
      paragraphIndex: paragraphIndex,
      originalText,
      editedText,
    });
    return NextResponse.json({ id: editId, classificationStatus: "pending" }, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_BLOG_NOT_FOUND)) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[edits/POST] error:", err);
    return NextResponse.json({ error: "Failed to record edit" }, { status: 500 });
  }
}
