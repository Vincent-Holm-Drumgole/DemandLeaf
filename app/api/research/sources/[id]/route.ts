import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const sourceId = parseConvexId(id, "researchSources");
  if (!sourceId) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  let body: {
    label?: string;
    type?: string;
    url?: string;
    keywords?: string[];
    status?: "active" | "paused" | "error";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  await convex.mutation(api.research.updateSource, {
    sourceId,
    label: typeof body.label === "string" ? body.label.trim() || undefined : undefined,
    type: body.type === "rss" || body.type === "url" ? body.type : undefined,
    url: typeof body.url === "string" ? body.url.trim() || undefined : undefined,
    keywords: Array.isArray(body.keywords)
      ? body.keywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
      : undefined,
    status: body.status,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const sourceId = parseConvexId(id, "researchSources");
  if (!sourceId) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  await convex.mutation(api.research.removeSource, { sourceId });
  return NextResponse.json({ success: true });
}
