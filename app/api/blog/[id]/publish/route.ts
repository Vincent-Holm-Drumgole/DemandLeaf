import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptCredentials } from "@/lib/publishing/credentials";
import { WpClient } from "@/lib/publishing/wp-client";
import { inngest } from "@/lib/inngest/client";
import type { WpPostStatus } from "@/types";
import type { Id } from "@/convex/_generated/dataModel";

const VALID_WP_STATUSES = new Set<WpPostStatus>([
  "draft",
  "publish",
  "future",
  "private",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await checkRateLimit(`wp-publish:${userId}`, {
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(rawBody)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const wpConnectionIdRaw = rawBody.wpConnectionId;
  const statusRaw = rawBody.status;
  const scheduledAtRaw = rawBody.scheduledAt;
  const authorPersonaIdRaw = rawBody.authorPersonaId;
  const republishRaw = rawBody.republish;

  if (typeof wpConnectionIdRaw !== "string" || wpConnectionIdRaw.trim().length === 0) {
    return NextResponse.json(
      { error: "wpConnectionId is required" },
      { status: 400 }
    );
  }
  if (
    typeof statusRaw !== "string" ||
    !VALID_WP_STATUSES.has(statusRaw as WpPostStatus)
  ) {
    return NextResponse.json(
      { error: "status must be one of: draft, publish, future, private" },
      { status: 400 }
    );
  }
  if (
    scheduledAtRaw !== undefined &&
    (typeof scheduledAtRaw !== "number" || !Number.isFinite(scheduledAtRaw))
  ) {
    return NextResponse.json(
      { error: "scheduledAt must be a valid timestamp" },
      { status: 400 }
    );
  }
  if (
    authorPersonaIdRaw !== undefined &&
    typeof authorPersonaIdRaw !== "string"
  ) {
    return NextResponse.json(
      { error: "authorPersonaId must be a string" },
      { status: 400 }
    );
  }
  if (republishRaw !== undefined && typeof republishRaw !== "boolean") {
    return NextResponse.json(
      { error: "republish must be a boolean" },
      { status: 400 }
    );
  }

  const status = statusRaw as WpPostStatus;
  const scheduledAt = typeof scheduledAtRaw === "number" ? scheduledAtRaw : undefined;
  if (status === "future" && (!scheduledAt || scheduledAt <= Date.now())) {
    return NextResponse.json(
      { error: "scheduledAt is required and must be in the future for status=future" },
      { status: 400 }
    );
  }

  const body = {
    wpConnectionId: wpConnectionIdRaw.trim(),
    status,
    scheduledAt: status === "future" ? scheduledAt : undefined,
    authorPersonaId:
      typeof authorPersonaIdRaw === "string" ? authorPersonaIdRaw.trim() : undefined,
    republish: republishRaw === true,
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

  // Prevent duplicate publishes — if already pushed to WP, require explicit re-publish
  if (blog.wpPostId && !body.republish) {
    return NextResponse.json(
      {
        error: "Blog is already published to WordPress",
        wpPostId: blog.wpPostId,
        wpPostUrl: blog.wpPostUrl,
      },
      { status: 409 }
    );
  }

  const connectionId = parseConvexId(body.wpConnectionId, "wpConnections");
  if (!connectionId) {
    return NextResponse.json({ error: "Invalid connection ID" }, { status: 400 });
  }

  const conn = await convex.query(api.wpConnections.getById, { connectionId });
  if (!conn || conn.workspaceId !== workspace._id) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  // Decrypt credentials
  let creds: { username: string; appPassword: string };
  try {
    const credJson = decryptCredentials(
      conn.encryptedCredentials,
      conn.credentialIv,
      conn.credentialTag
    );
    creds = JSON.parse(credJson);
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt credentials" },
      { status: 500 }
    );
  }

  // Load author persona if specified
  let wpAuthorId: number | undefined;
  let validPersonaId: Id<"authorPersonas"> | null = null;
  if (body.authorPersonaId) {
    validPersonaId = parseConvexId(body.authorPersonaId, "authorPersonas");
    if (validPersonaId) {
      const personas = await convex.query(api.authorPersonas.listByWorkspace, {
        workspaceId: workspace._id,
      });
      const persona = personas.find((p) => p._id === validPersonaId);
      wpAuthorId = persona?.wpAuthorId ?? undefined;
    }
  }

  // Publish to WordPress
  try {
    const client = new WpClient(conn.siteUrl, creds);
    const postArgs = {
      title: blog.title,
      content: blog.contentHtml ?? blog.content,
      status: body.status,
      slug: blog.slug ?? "",
      metaDescription: blog.metaDescription ?? undefined,
      focusKeyword: blog.focusKeyword ?? undefined,
      schemaJson: blog.schemaJson ?? undefined,
      scheduledAt: body.scheduledAt
        ? new Date(body.scheduledAt).toISOString()
        : undefined,
      authorId: wpAuthorId,
      pluginDetected: conn.pluginDetected ?? undefined,
    };

    // Re-publish: update existing WP post; first publish: create new
    const wpPost = blog.wpPostId
      ? await client.updatePost(blog.wpPostId, postArgs)
      : await client.createPost(postArgs);

    // Persist publishing data
    await convex.mutation(api.blogs.updatePublishingData, {
      blogId,
      wpPostId: wpPost.id,
      wpPostUrl: wpPost.link,
      wpStatus: body.status,
      wpConnectionId: connectionId,
      publishedAt: Date.now(),
      ...(body.scheduledAt && { wpScheduledAt: body.scheduledAt }),
      ...(validPersonaId && { authorPersonaId: validPersonaId }),
    });

    // Only mark as "published" when actually live on WP (not draft/scheduled)
    if (body.status === "publish") {
      await convex.mutation(api.blogs.update, {
        blogId,
        status: "published",
      });
    }

    // Phase 7: Fire event for Internal Links Agent
    if (body.status === "publish" && blog.focusKeyword) {
      inngest
        .send({
          name: "blog/published",
          data: {
            blogId: blogId as string,
            workspaceId: workspace._id as string,
            focusKeyword: blog.focusKeyword,
          },
        })
        .catch((err) => console.warn("[publish] inngest.send failed:", { blogId, err }));
    }

    return NextResponse.json({
      success: true,
      wpPostId: wpPost.id,
      wpPostUrl: wpPost.link,
    });
  } catch (err) {
    // FM-5: Graceful degradation — blog saved locally, offer fallback
    console.error("[publish/POST] WordPress publish failed:", err);
    return NextResponse.json(
      {
        success: false,
        fallbackAvailable: true,
        error: err instanceof Error ? err.message : "WordPress publish failed",
        message:
          "Publishing failed. Your blog is saved and ready. Download or copy HTML to publish manually.",
      },
      { status: 502 }
    );
  }
}
