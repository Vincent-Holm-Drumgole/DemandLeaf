import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { scoreAEO, AEO_PASS_THRESHOLD } from "@/lib/aeo/scorer";
import { optimizeForAEO } from "@/lib/aeo/optimizer";
import { generateSchema } from "@/lib/aeo/schema-generator";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await checkRateLimit(`aeo:${userId}`, {
    limit: 20,
    windowSec: 60,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000))
          ),
        },
      }
    );
  }

  const { id } = await context.params;
  const blogId = parseConvexId(id, "blogs");
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    optimize?: boolean;
  };

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const blog = await convex.query(api.blogs.getById, { blogId });
  if (!blog || blog.workspaceId !== workspace._id) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  // Score AEO
  let aeoResult = scoreAEO({ content: blog.content, title: blog.title });
  let optimized = false;
  let updatedContent = blog.content;

  // Conditionally optimize
  if (body.optimize && aeoResult.score < AEO_PASS_THRESHOLD) {
    try {
      const failedChecks = aeoResult.checks
        .filter((c) => !c.passed)
        .map((c) => c.name);
      const optResult = await optimizeForAEO(
        blog.content,
        aeoResult,
        failedChecks
      );
      if (optResult.changed) {
        updatedContent = optResult.content;
        aeoResult = scoreAEO({
          content: updatedContent,
          title: blog.title,
        });
        optimized = true;

        // Persist updated content
        await convex.mutation(api.blogs.update, {
          blogId,
          content: updatedContent,
        });
      }
    } catch (err) {
      console.error("[aeo/optimize]", err);
    }
  }

  // Generate schema
  const defaultPersona = await convex.query(api.authorPersonas.getDefault, {
    workspaceId: workspace._id,
  });

  const schemaMarkup = generateSchema({
    title: blog.title,
    metaDescription: blog.metaDescription ?? "",
    slug: blog.slug ?? "",
    siteUrl: workspace.url ?? "",
    content: updatedContent,
    publishedAt: blog.publishedAt ?? undefined,
    authorPersona: defaultPersona
      ? {
          _id: defaultPersona._id,
          workspaceId: defaultPersona.workspaceId,
          name: defaultPersona.name,
          jobTitle: defaultPersona.jobTitle,
          bio: defaultPersona.bio,
          socialUrls: defaultPersona.socialUrls,
          expertiseAreas: defaultPersona.expertiseAreas,
          isDefault: defaultPersona.isDefault,
        }
      : undefined,
  });

  // Persist AEO score and schema
  await convex.mutation(api.blogs.updatePublishingData, {
    blogId,
    aeoScore: aeoResult.score,
    schemaType: schemaMarkup.type,
    schemaJson: schemaMarkup.json,
  });

  return NextResponse.json({
    aeoScore: aeoResult,
    schemaMarkup,
    optimized,
  });
}
