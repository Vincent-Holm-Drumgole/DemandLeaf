import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { generateBrief } from "@/lib/brief";
import {
  ERR_KEYWORD_NOT_FOUND,
  ERR_KEYWORD_ALREADY_BRIEFED,
  ERR_UNAUTHORIZED,
} from "@/convex/errors";
import { hasConvexErrorCode } from "@/lib/convex-error";

export const maxDuration = 120;

function getBriefGenerationErrorResponse(err: unknown): NextResponse {
  if (err instanceof Error) {
    if (hasConvexErrorCode(err, ERR_KEYWORD_NOT_FOUND)) {
      return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
    }
    if (err.message.includes(ERR_KEYWORD_ALREADY_BRIEFED)) {
      return NextResponse.json({ error: "A brief already exists for this keyword" }, { status: 409 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      err.message === "Brief generation returned invalid JSON"
      || err.message === "Brief generation returned invalid brief shape"
    ) {
      return NextResponse.json(
        { error: "Brief generation is temporarily unavailable" },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 });
}

// POST /api/brief/generate — generate a content brief for a keyword
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`brief-generate:${userId}`, { limit: 20, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: { keywordId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.keywordId) {
    return NextResponse.json({ error: "keywordId is required" }, { status: 400 });
  }
  const keywordId = parseConvexId(body.keywordId, "keywords");
  if (!keywordId) return NextResponse.json({ error: "Invalid keywordId" }, { status: 400 });

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(convex);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    // generateBrief handles: SERP, cannibalization, KB context, voice, Claude call
    const briefData = await generateBrief(convex, workspace._id, keywordId);

    const briefId = await convex.mutation(api.contentBriefs.create, {
      workspaceId: workspace._id,
      keywordId,
      briefData,
    });

    return NextResponse.json({ briefId, briefData }, { status: 201 });
  } catch (err) {
    console.error("[brief/generate/POST] error:", err);
    return getBriefGenerationErrorResponse(err);
  }
}
