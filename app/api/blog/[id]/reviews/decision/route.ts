import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_REVIEW_REQUEST_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteParams,
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`review-decision:${userId}`, { limit: 30, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: { reviewRequestId: string; status: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reviewRequestId = parseConvexId(body.reviewRequestId, "reviewRequests");
  if (!reviewRequestId) {
    return NextResponse.json({ error: "Invalid reviewRequestId" }, { status: 400 });
  }

  if (body.status !== "approved" && body.status !== "changes_requested") {
    return NextResponse.json({ error: "status must be 'approved' or 'changes_requested'" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.reviews.submitDecision, {
      reviewRequestId,
      status: body.status,
      note: body.note,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_REVIEW_REQUEST_NOT_FOUND)) {
      return NextResponse.json({ error: "Review request not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[blog/[id]/reviews/decision/POST] error:", err);
    return NextResponse.json({ error: "Failed to submit decision" }, { status: 500 });
  }
}
