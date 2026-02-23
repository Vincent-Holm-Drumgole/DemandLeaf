import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { DashboardResponse, DashboardBlog } from "@/types";

const PAGE_SIZE = 20;

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor"); // ISO string of last item's createdAt

  const workspace = await prisma.workspace.findFirst({
    where: { userId },
    select: {
      id: true,
      name: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!workspace) {
    const response: DashboardResponse = {
      blogs: [],
      workspaceName: "My Workspace",
      nextCursor: null,
      total: 0,
    };
    return NextResponse.json(response);
  }

  const where = { workspaceId: workspace.id };

  const [total, blogs] = await Promise.all([
    prisma.blog.count({ where }),
    prisma.blog.findMany({
      where: cursor
        ? { ...where, createdAt: { lt: new Date(cursor) } }
        : where,
      select: {
        id: true,
        title: true,
        archetype: true,
        status: true,
        seoScore: true,
        qualityScore: true,
        detectionRisk: true,
        wordCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1, // fetch one extra to detect if there's a next page
    }),
  ]);

  const hasNextPage = blogs.length > PAGE_SIZE;
  const page = hasNextPage ? blogs.slice(0, PAGE_SIZE) : blogs;
  const nextCursor = hasNextPage ? page[page.length - 1].createdAt.toISOString() : null;

  const dashboardBlogs: DashboardBlog[] = page.map((blog) => ({
    id: blog.id,
    title: blog.title,
    archetype: blog.archetype as DashboardBlog["archetype"],
    status: blog.status,
    seoScore: blog.seoScore,
    qualityScore: blog.qualityScore,
    detectionRisk: blog.detectionRisk,
    wordCount: blog.wordCount,
    createdAt: blog.createdAt.toISOString(),
  }));

  const response: DashboardResponse = {
    blogs: dashboardBlogs,
    workspaceName: workspace.name,
    nextCursor,
    total,
  };

  return NextResponse.json(response);
}
