import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { KBEntryType } from "@/types";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const VALID_ENTRY_TYPES = new Set<KBEntryType>([
  "company_info", "product", "audience", "competitor", "industry",
  "customer_story", "expert_insight", "proprietary_data", "hot_take",
  "lesson_learned", "methodology", "thought_leadership_position",
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entryType = searchParams.get("type") ?? undefined;

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let entries;
  try {
    entries = await convex.query(api.knowledgeBase.listByWorkspace, {
      workspaceId: workspace._id,
      entryType: entryType && VALID_ENTRY_TYPES.has(entryType as KBEntryType) ? entryType : undefined,
    });
  } catch (err) {
    console.error("[knowledge-base/GET] query error:", err);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e._id,
      entryType: e.entryType,
      title: e.title,
      content: e.content,
      tags: e.tags,
      embeddingStatus: e.embeddingStatus,
      createdAt: new Date(e.createdAt).toISOString(),
      updatedAt: new Date(e.updatedAt).toISOString(),
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
  if (content.length > 2000) {
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
    console.error("[knowledge-base/POST] mutation error:", err);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }

  return NextResponse.json({ id: entryId, embeddingStatus: "pending" }, { status: 201 });
}
