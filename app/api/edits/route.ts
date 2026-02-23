import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate-limit per user: 50 edit records per hour
  const rateLimit = checkRateLimit(`edits:${userId}`, { limit: 50, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many edit submissions" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
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
  if (typeof paragraphIndex !== "number" || paragraphIndex < 0) {
    return NextResponse.json({ error: "paragraphIndex must be a non-negative number" }, { status: 400 });
  }
  if (!originalText || typeof originalText !== "string") {
    return NextResponse.json({ error: "originalText is required" }, { status: 400 });
  }
  if (!editedText || typeof editedText !== "string") {
    return NextResponse.json({ error: "editedText is required" }, { status: 400 });
  }
  // Only record edits with meaningful changes (>10 chars difference)
  if (Math.abs(editedText.length - originalText.length) < 10 && originalText === editedText) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const editId = await convex.mutation(api.blogEdits.recordEdit, {
      blogId: blogId as Id<"blogs">,
      workspaceId: workspace._id,
      paragraphIndex,
      originalText,
      editedText,
    });
    return NextResponse.json({ id: editId, classificationStatus: "pending" }, { status: 201 });
  } catch (err) {
    console.error("[edits/POST] error:", err);
    return NextResponse.json({ error: "Failed to record edit" }, { status: 500 });
  }
}
