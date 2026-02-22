import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { DashboardResponse, DashboardBlog } from "@/types";

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    };
    return NextResponse.json(response);
  }

  const blogs = await prisma.blog.findMany({
    where: { workspaceId: workspace.id },
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
  });

  const dashboardBlogs: DashboardBlog[] = blogs.map((blog) => ({
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
  };

  return NextResponse.json(response);
}
