import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { DashboardResponse, DashboardBlog } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;

  const convex = await getAuthedConvexClient();
  const data = await convex.query(api.blogs.listByWorkspace, {
    cursor: cursor !== undefined && Number.isFinite(cursor) ? cursor : undefined,
  });

  const dashboardBlogs: DashboardBlog[] = data.blogs.map((blog) => ({
    id: blog._id,
    title: blog.title,
    archetype: blog.archetype as DashboardBlog["archetype"],
    status: blog.status,
    seoScore: blog.seoScore ?? null,
    qualityScore: blog.qualityScore ?? null,
    detectionRisk: blog.detectionRisk ?? null,
    wordCount: blog.wordCount ?? null,
    createdAt: new Date(blog.createdAt).toISOString(),
  }));

  const response: DashboardResponse = {
    blogs: dashboardBlogs,
    workspaceName: data.workspaceName,
    nextCursor: data.nextCursor !== null ? String(data.nextCursor) : null,
    total: data.total,
  };

  return NextResponse.json(response);
}
