import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_BLOG_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";

export async function GET(
  request: Request,
  context: { params: Promise<{ blogId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`scorecard-blog:${userId}`, {
    limit: 120,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } }
    );
  }

  const { blogId: rawId } = await context.params;
  const blogId = parseConvexId(rawId, "blogs");
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const score = await convex.query(api.scoredOutputs.getByBlog, {
      workspaceId: workspace._id,
      blogId,
    });

    return NextResponse.json({ score });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (hasConvexErrorCode(err, ERR_BLOG_NOT_FOUND)) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }
    console.error("[scorecard/blog/GET] error:", err);
    return NextResponse.json({ error: "Failed to load score" }, { status: 500 });
  }
}
