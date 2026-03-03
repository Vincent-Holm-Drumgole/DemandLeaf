import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ blogId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`rank-snapshots:${userId}`, {
    limit: 60,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { blogId: rawId } = await context.params;
  const blogId = parseConvexId(rawId, "blogs");
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const snapshots = await convex.query(api.rankSnapshots.getSnapshotsForBlog, {
    blogId,
    limit: 52,
  });

  // Compute trend summary
  const withPosition = snapshots.filter(
    (s: { position?: number | null }) => s.position != null
  );
  const latestPosition = withPosition[0]?.position ?? null;
  const oldestPosition =
    withPosition.length > 1
      ? withPosition[withPosition.length - 1]?.position ?? null
      : null;
  const positionChange =
    latestPosition !== null && oldestPosition !== null
      ? oldestPosition - latestPosition // positive = improved
      : null;

  return NextResponse.json({
    snapshots: snapshots.map(
      (s: {
        _id: string;
        keyword: string;
        position?: number | null;
        url?: string | null;
        checkedAt: number;
      }) => ({
        id: s._id,
        keyword: s.keyword,
        position: s.position ?? null,
        url: s.url ?? null,
        checkedAt: s.checkedAt,
      })
    ),
    summary: {
      latestPosition,
      positionChange,
      totalSnapshots: snapshots.length,
    },
  });
}
