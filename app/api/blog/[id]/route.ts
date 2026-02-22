import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const params = await context.params;
  const blogId = params.id;

  if (!blogId) {
    return NextResponse.json({ error: "Blog ID is required" }, { status: 400 });
  }

  const blog = await prisma.blog.findUnique({
    where: { id: blogId },
    include: {
      feedback: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!blog) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: blog.id,
    title: blog.title,
    slug: blog.slug,
    content: blog.content,
    contentHtml: blog.contentHtml,
    metaTitle: blog.metaTitle,
    metaDescription: blog.metaDescription,
    focusKeyword: blog.focusKeyword,
    archetype: blog.archetype,
    wordCount: blog.wordCount,
    status: blog.status,
    scores: {
      seoScore: blog.seoScore,
      qualityScore: blog.qualityScore,
      detectionRisk: blog.detectionRisk,
      detectionRiskScore: blog.detectionRiskScore,
      burstinessScore: blog.burstinessScore,
      readabilityScore: blog.readabilityScore,
    },
    modelUsed: blog.modelUsed,
    inputTokens: blog.inputTokens,
    outputTokens: blog.outputTokens,
    generationCostCents: blog.generationCostCents,
    generationTimeMs: blog.generationTimeMs,
    promptVersion: blog.promptVersion,
    createdAt: blog.createdAt.toISOString(),
    updatedAt: blog.updatedAt.toISOString(),
    feedback: blog.feedback.map((f) => ({
      id: f.id,
      paragraphIndex: f.paragraphIndex,
      feedback: f.feedback,
      comment: f.comment,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}
