import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    domain?: string;
    url?: string;
    title?: string;
    summary?: string;
    angle?: string;
    keywords?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.domain || !body.url || !body.title || !body.summary || !body.angle) {
    return NextResponse.json({ error: "domain, url, title, summary, and angle are required" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const articleId = await convex.mutation(api.research.createCompetitorArticle, {
    workspaceId: workspace._id,
    domain: body.domain.trim(),
    url: body.url.trim(),
    title: body.title.trim(),
    summary: body.summary.trim(),
    angle: body.angle.trim(),
    keywords: Array.isArray(body.keywords)
      ? body.keywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
      : [],
  });

  return NextResponse.json({ id: articleId }, { status: 201 });
}
