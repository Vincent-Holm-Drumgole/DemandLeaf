import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireRequestWorkspace } from "@/lib/workspace-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ blogId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`rank-snapshots:${userId}`, {
    limit: 60,
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
  const snapshots = await convex.query(api.rankSnapshots.getSnapshotsForBlog, {
    blogId,
    limit: 52,
  });

  // Compute trend summary scoped to the focus keyword
  const blog = await convex.query(api.blogs.getById, { blogId });
  if (!blog || blog.workspaceId !== workspace._id) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }
  const focusKeyword = blog?.focusKeyword ?? null;
  const withPosition = snapshots.filter(
    (s) => s.position != null && (!focusKeyword || s.keyword === focusKeyword)
  );
  const latestPosition = withPosition[0]?.position ?? null;
  const oldestPosition =
    withPosition.length > 1
      ? withPosition[withPosition.length - 1]?.position ?? null
      : null;
  const positionChange =
    latestPosition !== null && oldestPosition !== null
      ? oldestPosition - latestPosition // positive = improved
      : null;

  return NextResponse.json({
    snapshots: snapshots.map((s) => ({
      id: s._id,
      keyword: s.keyword,
      position: s.position ?? null,
      url: s.url ?? null,
      checkedAt: s.checkedAt,
    })),
    summary: {
      latestPosition,
      positionChange,
      totalSnapshots: snapshots.length,
    },
  });
}
