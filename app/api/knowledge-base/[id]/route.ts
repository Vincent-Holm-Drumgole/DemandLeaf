import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let entry;
  try {
    entry = await convex.query(api.knowledgeBase.getById, {
      entryId: id as Id<"knowledgeBase">,
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

  const { id } = await context.params;
  let body: { title?: string; content?: string; tags?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.content && body.content.length > 2000) {
    return NextResponse.json({ error: "content must be 2000 characters or less" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await convex.mutation(api.knowledgeBase.update, {
      entryId: id as Id<"knowledgeBase">,
      workspaceId: workspace._id,
      title: body.title?.trim(),
      content: body.content?.trim(),
      tags: body.tags,
    });
  } catch (err) {
    console.error("[knowledge-base/[id]/PUT] error:", err);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await convex.mutation(api.knowledgeBase.remove, {
      entryId: id as Id<"knowledgeBase">,
      workspaceId: workspace._id,
    });
  } catch (err) {
    console.error("[knowledge-base/[id]/DELETE] error:", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
