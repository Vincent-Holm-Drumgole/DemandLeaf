import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkRankPosition } from "@/lib/seo-data/dataforseo";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`rank-check:${userId}`, {
    limit: 20,
    windowSec: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  let body: { blogId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.blogId) {
    return NextResponse.json({ error: "blogId is required" }, { status: 400 });
  }

  const blogId = parseConvexId(body.blogId, "blogs");
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const blog = await convex.query(api.blogs.getById, { blogId });
  if (!blog || blog.workspaceId !== workspace._id) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  if (!blog.focusKeyword) {
    return NextResponse.json(
      { error: "Blog has no focus keyword" },
      { status: 400 }
    );
  }

  if (!blog.wpPostUrl) {
    return NextResponse.json(
      { error: "Blog is not published to WordPress" },
      { status: 400 }
    );
  }

  try {
    const result = await checkRankPosition(
      convex,
      blog.focusKeyword,
      blog.wpPostUrl
    );

    // Persist the snapshot
    await convex.mutation(api.rankSnapshots.insertSnapshot, {
      workspaceId: workspace._id,
      blogId,
      keyword: blog.focusKeyword,
      position: result.position ?? undefined,
      url: result.url ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[rank-check/POST]", err);
    return NextResponse.json(
      { error: "Rank check failed" },
      { status: 500 }
    );
  }
}
