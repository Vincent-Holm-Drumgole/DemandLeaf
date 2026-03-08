import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireRequestWorkspace } from "@/lib/workspace-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const blogId = params.id;

  const blogIdTyped = parseConvexId(blogId, "blogs");
  if (!blogIdTyped) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  let blog: FunctionReturnType<typeof api.blogs.getById>;
  try {
    blog = await convex.query(api.blogs.getById, {
      blogId: blogIdTyped,
    });
  } catch (err) {
    console.error("[blog/GET] query error:", err);
    return NextResponse.json({ error: "Unable to fetch blog" }, { status: 500 });
  }

  if (!blog) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }
  if (blog.workspaceId !== workspace._id) {
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
    contentTrack: blog.contentTrack ?? "evergreen",
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
    // Phase 5: AEO/Publishing fields
    aeoScore: blog.aeoScore ?? null,
    schemaType: blog.schemaType ?? null,
    schemaJson: blog.schemaJson ?? null,
    wpPostId: blog.wpPostId ?? null,
    wpPostUrl: blog.wpPostUrl ?? null,
    wpStatus: blog.wpStatus ?? null,
    authorPersonaId: blog.authorPersonaId ?? null,
    publishedAt: blog.publishedAt ? new Date(blog.publishedAt).toISOString() : null,
    createdAt: new Date(blog.createdAt).toISOString(),
    updatedAt: new Date(blog.updatedAt).toISOString(),
    factCheck: blog.factCheck
      ? {
          claims: blog.factCheck.claims,
          reviewedAt: blog.factCheck.reviewedAt ?? null,
          reviewedBy: blog.factCheck.reviewedBy ?? null,
          unverifiedCount: blog.factCheck.unverifiedCount,
          mismatchCount: blog.factCheck.mismatchCount,
        }
      : null,
    publicationCheck: blog.publicationCheck
      ? {
          qualityBreakdown: blog.publicationCheck.qualityBreakdown,
          checklist: blog.publicationCheck.checklist,
          blockers: blog.publicationCheck.blockers,
          killSwitchTriggered: blog.publicationCheck.killSwitchTriggered,
          canPublish: blog.publicationCheck.canPublish,
          factCheck: blog.factCheck
            ? {
                claims: blog.factCheck.claims,
                reviewedAt: blog.factCheck.reviewedAt ?? undefined,
                reviewedBy: blog.factCheck.reviewedBy ?? undefined,
                unverifiedCount: blog.factCheck.unverifiedCount,
                mismatchCount: blog.factCheck.mismatchCount,
              }
            : {
                claims: [],
                unverifiedCount: 0,
                mismatchCount: 0,
              },
          updatedAt: blog.publicationCheck.updatedAt,
        }
      : null,
    feedback: blog.feedback.map((f: (typeof blog.feedback)[number]) => ({
      id: f._id,
      paragraphIndex: f.paragraphIndex,
      feedback: f.feedback,
      comment: f.comment ?? null,
      createdAt: new Date(f.createdAt).toISOString(),
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`blog-update:${userId}`, { limit: 60, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const params = await context.params;
  const blogIdTyped = parseConvexId(params.id, "blogs");
  if (!blogIdTyped) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const VALID_STATUSES = ["draft", "approved", "exported", "published"] as const;
  const stringFields = ["title", "content", "contentHtml", "metaTitle", "metaDescription", "focusKeyword", "slug", "status"] as const;

  for (const key of stringFields) {
    if (body[key] !== undefined && typeof body[key] !== "string") {
      return NextResponse.json({ error: `${key} must be a string` }, { status: 400 });
    }
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const fields: Record<string, string> = {};
  for (const key of stringFields) {
    if (typeof body[key] === "string") {
      fields[key] = body[key] as string;
    }
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const existingBlog = await convex.query(api.blogs.getById, { blogId: blogIdTyped });
  if (!existingBlog || existingBlog.workspaceId !== workspace._id) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  try {
    await convex.mutation(api.blogs.update, { blogId: blogIdTyped, ...fields });
    await convex.mutation(api.blogs.recalculatePublicationChecks, { blogId: blogIdTyped });
  } catch (err) {
    console.error("[blog/PATCH] mutation error:", err);
    return NextResponse.json({ error: "Failed to update blog" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
