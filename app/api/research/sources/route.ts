import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";

const VALID_SOURCE_TYPES = new Set(["rss", "url"] as const);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { label?: string; type?: string; url?: string; keywords?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.label || typeof body.label !== "string") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (!body.type || typeof body.type !== "string" || !VALID_SOURCE_TYPES.has(body.type as "rss" | "url")) {
    return NextResponse.json({ error: "type must be rss or url" }, { status: 400 });
  }
  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const sourceId = await convex.mutation(api.research.createSource, {
    workspaceId: workspace._id,
    label: body.label.trim(),
    type: body.type as "rss" | "url",
    url: body.url.trim(),
    keywords: Array.isArray(body.keywords)
      ? body.keywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
      : [],
  });

  return NextResponse.json({ id: sourceId }, { status: 201 });
}
