import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`kb-verify:${userId}`, { limit: 20, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { entryIds?: string[]; verifiedAt?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entryIds = Array.isArray(body.entryIds)
    ? body.entryIds
        .map((entryId) => parseConvexId(entryId, "knowledgeBase"))
        .filter((entryId): entryId is NonNullable<typeof entryId> => entryId !== null)
    : [];

  if (entryIds.length === 0) {
    return NextResponse.json({ error: "entryIds are required" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const result = await convex.mutation(api.knowledgeBase.markVerified, {
    workspaceId: workspace._id,
    entryIds,
    verifiedAt:
      typeof body.verifiedAt === "number" && Number.isFinite(body.verifiedAt)
        ? body.verifiedAt
        : undefined,
  });

  return NextResponse.json(result);
}
