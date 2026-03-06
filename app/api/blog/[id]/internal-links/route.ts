import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { findInternalLinks } from "@/lib/internal-links/engine";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await checkRateLimit(`internal-links:${userId}`, {
    limit: 10,
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

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex);
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

  try {
    const suggestions = await findInternalLinks(
      convex,
      workspace._id,
      blogId,
      blog.focusKeyword
    );

    // Persist suggestions to Convex — filter to valid IDs only
    const validSuggestions = suggestions
      .map((s) => {
        const targetId = parseConvexId(s.targetBlogId, "blogs");
        return targetId
          ? { targetBlogId: targetId, anchorText: s.anchorText, similarity: s.similarity }
          : null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    if (validSuggestions.length > 0) {
      await convex.mutation(api.internalLinks.upsertSuggestions, {
        workspaceId: workspace._id,
        sourceBlogId: blogId,
        suggestions: validSuggestions,
      });
    }

    await convex.mutation(api.blogs.updatePublishingData, {
      blogId,
      internalLinksGenerated: true,
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[internal-links/POST]", err);
    return NextResponse.json(
      { error: "Failed to find internal links" },
      { status: 500 }
    );
  }
}
