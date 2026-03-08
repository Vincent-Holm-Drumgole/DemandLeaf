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
  const briefId = parseConvexId(id, "researchBriefs");
  if (!briefId) {
    return NextResponse.json({ error: "Invalid brief ID" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  await convex.mutation(api.research.updateBrief, {
    briefId,
    status:
      body.status === "pending_review" || body.status === "approved" || body.status === "archived"
        ? body.status
        : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    whyItMatters: typeof body.whyItMatters === "string" ? body.whyItMatters : undefined,
    suggestedAngle: typeof body.suggestedAngle === "string" ? body.suggestedAngle : undefined,
    sourceUrls: Array.isArray(body.sourceUrls)
      ? body.sourceUrls.filter((value): value is string => typeof value === "string")
      : undefined,
    sourceNames: Array.isArray(body.sourceNames)
      ? body.sourceNames.filter((value): value is string => typeof value === "string")
      : undefined,
    keywords: Array.isArray(body.keywords)
      ? body.keywords.filter((value): value is string => typeof value === "string")
      : undefined,
    relevanceScore: typeof body.relevanceScore === "number" ? body.relevanceScore : undefined,
  });
  return NextResponse.json({ success: true });
}
