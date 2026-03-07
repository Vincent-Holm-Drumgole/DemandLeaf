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

  const rl = await checkRateLimit(`scorecard-dash:${userId}`, {
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
  const rawDays = url.searchParams.get("windowDays");
  const parsedDays = rawDays ? parseInt(rawDays, 10) : undefined;
  const windowDays = parsedDays !== undefined && Number.isFinite(parsedDays) ? parsedDays : undefined;

  try {
    const dashboard = await convex.query(api.scoredOutputs.getDashboard, {
      workspaceId: workspace._id,
      ...(windowDays !== undefined ? { windowDays } : {}),
    });

    return NextResponse.json(dashboard);
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[scorecard/dashboard/GET] error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
