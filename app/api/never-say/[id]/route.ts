import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_ENTRY_NOT_FOUND } from "@/convex/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`never-say-delete:${userId}`, { limit: 30, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  const { id } = await context.params;
  const entryId = parseConvexId(id, "neverSayList");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await convex.mutation(api.neverSayList.remove, {
      entryId,
      workspaceId: workspace._id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_ENTRY_NOT_FOUND)) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    console.error("[never-say/[id]/DELETE] error:", err);
    return NextResponse.json({ error: "Failed to delete term" }, { status: 500 });
  }
}
