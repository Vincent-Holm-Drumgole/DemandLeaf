import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const blogId = params.id;

  if (!blogId) {
    return NextResponse.json({ error: "Blog ID is required" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  let blog: FunctionReturnType<typeof api.blogs.getById>;
  try {
    blog = await convex.query(api.blogs.getById, {
      blogId: blogId as Id<"blogs">,
    });
  } catch {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  if (!blog) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: blog._id,
    title: blog.title,
    slug: blog.slug ?? null,
    content: blog.content,
    contentHtml: blog.contentHtml ?? null,
    metaTitle: blog.metaTitle ?? null,
    metaDescription: blog.metaDescription ?? null,
    focusKeyword: blog.focusKeyword ?? null,
    archetype: blog.archetype,
    wordCount: blog.wordCount ?? null,
    status: blog.status,
    scores: {
      seoScore: blog.seoScore ?? null,
      qualityScore: blog.qualityScore ?? null,
      detectionRisk: blog.detectionRisk ?? null,
      detectionRiskScore: blog.detectionRiskScore ?? null,
      burstinessScore: blog.burstinessScore ?? null,
      readabilityScore: blog.readabilityScore ?? null,
    },
    modelUsed: blog.modelUsed ?? null,
    inputTokens: blog.inputTokens ?? null,
    outputTokens: blog.outputTokens ?? null,
    generationCostCents: blog.generationCostCents ?? null,
    generationTimeMs: blog.generationTimeMs ?? null,
    promptVersion: blog.promptVersion ?? null,
    createdAt: new Date(blog.createdAt).toISOString(),
    updatedAt: new Date(blog.updatedAt).toISOString(),
    feedback: blog.feedback.map((f) => ({
      id: f._id,
      paragraphIndex: f.paragraphIndex,
      feedback: f.feedback,
      comment: f.comment ?? null,
      createdAt: new Date(f.createdAt).toISOString(),
    })),
  });
}
