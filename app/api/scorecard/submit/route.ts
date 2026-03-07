import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import {
  ERR_BLOG_ALREADY_SCORED,
  ERR_BLOG_NOT_FOUND,
  ERR_COACHING_NOTE_TOO_LONG,
  ERR_INVALID_DIMENSION_SCORE,
  ERR_UNAUTHORIZED,
} from "@/convex/errors";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`scorecard-submit:${userId}`, {
    limit: 30,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } }
    );
  }

  const body = await request.json();
  const blogId = parseConvexId(body.blogId, "blogs");
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const result = await convex.mutation(api.scoredOutputs.submit, {
      workspaceId: workspace._id,
      blogId,
      brandVoice: body.brandVoice,
      structure: body.structure,
      depthAccuracy: body.depthAccuracy,
      readability: body.readability,
      onTopicFocus: body.onTopicFocus,
      reasonTags: body.reasonTags ?? [],
      coachingNote: body.coachingNote || undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (hasConvexErrorCode(err, ERR_BLOG_NOT_FOUND)) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_BLOG_ALREADY_SCORED)) {
      return NextResponse.json({ error: "This blog has already been scored" }, { status: 409 });
    }
    if (hasConvexErrorCode(err, ERR_INVALID_DIMENSION_SCORE)) {
      return NextResponse.json({ error: "Each dimension score must be 1-5" }, { status: 400 });
    }
    if (hasConvexErrorCode(err, ERR_COACHING_NOTE_TOO_LONG)) {
      return NextResponse.json({ error: "Coaching note must be 300 characters or fewer" }, { status: 400 });
    }
    console.error("[scorecard/submit/POST] error:", err);
    return NextResponse.json({ error: "Failed to submit scorecard" }, { status: 500 });
  }
}
