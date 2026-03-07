import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_ENTRY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { MAX_KB_CONTENT_CHARS } from "@/lib/knowledge-base/constants";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`kb-get:${userId}`, { limit: 120, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await context.params;
  const entryId = parseConvexId(id, "knowledgeBase");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let entry;
  try {
    entry = await convex.query(api.knowledgeBase.getById, {
      entryId,
      workspaceId: workspace._id,
    });
  } catch (err) {
    console.error("[knowledge-base/[id]/GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PUT(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`kb-update:${userId}`, { limit: 30, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await context.params;
  const entryId = parseConvexId(id, "knowledgeBase");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  let body: { title?: string; content?: string; tags?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.content && body.content.length > MAX_KB_CONTENT_CHARS) {
    return NextResponse.json(
      { error: `content must be ${MAX_KB_CONTENT_CHARS} characters or less` },
      { status: 400 },
    );
  }
  if (body.tags && !Array.isArray(body.tags)) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await convex.mutation(api.knowledgeBase.update, {
      entryId,
      workspaceId: workspace._id,
      title: body.title?.trim(),
      content: body.content?.trim(),
      tags: body.tags?.filter((tag): tag is string => typeof tag === "string"),
    });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_ENTRY_NOT_FOUND)) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/[id]/PUT] error:", err);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`kb-delete:${userId}`, { limit: 30, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await context.params;
  const entryId = parseConvexId(id, "knowledgeBase");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await convex.mutation(api.knowledgeBase.remove, {
      entryId,
      workspaceId: workspace._id,
    });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_ENTRY_NOT_FOUND)) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/[id]/DELETE] error:", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
