import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_UNAUTHORIZED } from "@/convex/errors";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`scorecard-queue:${userId}`, {
    limit: 120,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } }
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : undefined;
  const limit = parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  try {
    const blogs = await convex.query(api.scoredOutputs.listUnscored, {
      workspaceId: workspace._id,
      ...(limit !== undefined ? { limit } : {}),
    });

    return NextResponse.json({ blogs });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[scorecard/queue/GET] error:", err);
    return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 });
  }
}
