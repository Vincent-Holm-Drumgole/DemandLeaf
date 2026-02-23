import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { KBEntryType } from "@/types";
import { KB_ENTRY_TYPES } from "@/types/knowledge-base";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { FunctionReturnType } from "convex/server";

const VALID_ENTRY_TYPES = new Set<KBEntryType>(KB_ENTRY_TYPES);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entryTypeRaw = searchParams.get("type");
  const entryType =
    entryTypeRaw && VALID_ENTRY_TYPES.has(entryTypeRaw as KBEntryType)
      ? (entryTypeRaw as KBEntryType)
      : undefined;

  if (entryTypeRaw && !entryType) {
    return NextResponse.json({ error: "Invalid entry type filter" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let entries: FunctionReturnType<typeof api.knowledgeBase.listByWorkspace>;
  try {
    entries = await convex.query(api.knowledgeBase.listByWorkspace, {
      workspaceId: workspace._id,
      entryType,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/GET] query error:", err);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e._id,
      workspaceId: e.workspaceId,
      entryType: e.entryType,
      title: e.title,
      content: e.content,
      tags: e.tags,
      embeddingStatus: e.embeddingStatus,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`kb-create:${ip}`, { limit: 30, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  let body: { entryType?: string; title?: string; content?: string; tags?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { entryType, title, content, tags = [] } = body;

  if (!entryType || !VALID_ENTRY_TYPES.has(entryType as KBEntryType)) {
    return NextResponse.json({ error: "Invalid or missing entryType" }, { status: 400 });
  }
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.trim().length > 2000) {
    return NextResponse.json({ error: "content must be 2000 characters or less" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let entryId: Id<"knowledgeBase">;
  try {
    entryId = await convex.mutation(api.knowledgeBase.create, {
      workspaceId: workspace._id,
      entryType: entryType as KBEntryType,
      title: title.trim(),
      content: content.trim(),
      tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [],
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/POST] mutation error:", err);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }

  return NextResponse.json({ id: entryId, embeddingStatus: "pending" }, { status: 201 });
}
