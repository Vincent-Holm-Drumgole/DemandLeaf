import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_BRIEF_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { isBriefData } from "@/lib/brief/validate";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { requireRequestWorkspace } from "@/lib/workspace-server";

// GET /api/brief/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`brief-get:${userId}`, { limit: 60, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await params;
  const briefId = parseConvexId(id, "contentBriefs");
  if (!briefId) return NextResponse.json({ error: "Invalid brief id" }, { status: 400 });

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex, request);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const brief = await convex.query(api.contentBriefs.getById, { briefId });
    if (!brief || brief.workspaceId !== workspace._id) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }
    if (!isBriefData(brief.briefData)) {
      console.error("[brief/[id]/GET] invalid briefData shape for brief:", brief._id);
      return NextResponse.json({ error: "Invalid brief data" }, { status: 500 });
    }
    return NextResponse.json({ brief });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_BRIEF_NOT_FOUND)) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[brief/[id]/GET] error:", err);
    return NextResponse.json({ error: "Failed to load brief" }, { status: 500 });
  }
}
