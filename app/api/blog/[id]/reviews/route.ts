import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_BLOG_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { requireRequestWorkspace } from "@/lib/workspace-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams,
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const blogId = parseConvexId(params.id, "blogs");
  if (!blogId) return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });

  try {
    const convex = await getAuthedConvexClient();
    const wantMembers = request.nextUrl.searchParams.get("members") === "true";
    const wsId = request.nextUrl.searchParams.get("workspaceId");

    const queries: [
      Promise<unknown>,
      Promise<unknown>,
      Promise<unknown>,
      Promise<unknown>,
      Promise<unknown>,
    ] = [
      convex.query(api.reviews.listReviewRequests, { blogId }),
      convex.query(api.reviews.listCommentsByBlog, { blogId }),
      convex.query(api.reviews.listActivityByBlog, { blogId }),
      convex.query(api.reviews.getReviewStatus, { blogId }),
      wantMembers && wsId
        ? convex.query(api.reviews.listWorkspaceMembers, {
            workspaceId: wsId as any,
          })
        : Promise.resolve(undefined),
    ];

    const [requests, comments, activity, status, members] = await Promise.all(queries);

    return NextResponse.json({ requests, comments, activity, status, ...(members ? { members } : {}) });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_BLOG_NOT_FOUND)) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[blog/[id]/reviews/GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams,
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`review-request:${userId}`, { limit: 20, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const params = await context.params;
  const blogId = parseConvexId(params.id, "blogs");
  if (!blogId) return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });

  let body: { reviewerClerkUserIds: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.reviewerClerkUserIds) || body.reviewerClerkUserIds.length === 0) {
    return NextResponse.json({ error: "reviewerClerkUserIds must be a non-empty array" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    const result = await convex.mutation(api.reviews.requestReview, {
      blogId,
      reviewerClerkUserIds: body.reviewerClerkUserIds,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_BLOG_NOT_FOUND)) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[blog/[id]/reviews/POST] error:", err);
    return NextResponse.json({ error: "Failed to request review" }, { status: 500 });
  }
}
