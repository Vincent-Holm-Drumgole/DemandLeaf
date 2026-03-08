import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_UNAUTHORIZED } from "@/convex/errors";
import { MAX_MASTER_CONTEXT_CHARS } from "@/lib/knowledge-base/constants";

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`workspace-profile:${userId}`, {
    limit: 30,
    windowSec: 60,
  });
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

  let body: {
    url?: string;
    industry?: string;
    audienceDescription?: string;
    masterContext?: string;
    minPublishQualityScore?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.masterContext !== undefined &&
    typeof body.masterContext === "string" &&
    body.masterContext.trim().length > MAX_MASTER_CONTEXT_CHARS
  ) {
    return NextResponse.json(
      { error: `masterContext must be ${MAX_MASTER_CONTEXT_CHARS} characters or less` },
      { status: 400 },
    );
  }
  if (
    body.minPublishQualityScore !== undefined &&
    (typeof body.minPublishQualityScore !== "number" ||
      !Number.isFinite(body.minPublishQualityScore) ||
      body.minPublishQualityScore < 0 ||
      body.minPublishQualityScore > 100)
  ) {
    return NextResponse.json(
      { error: "minPublishQualityScore must be a number between 0 and 100" },
      { status: 400 },
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    await convex.mutation(api.workspaces.updateProfile, {
      workspaceId: workspace._id,
      url: typeof body.url === "string" ? body.url.trim() || undefined : undefined,
      industry:
        typeof body.industry === "string" ? body.industry.trim() || undefined : undefined,
      audienceDescription:
        typeof body.audienceDescription === "string"
          ? body.audienceDescription.trim() || undefined
          : undefined,
      masterContext:
        typeof body.masterContext === "string"
          ? body.masterContext.trim() || undefined
          : undefined,
      minPublishQualityScore:
        typeof body.minPublishQualityScore === "number"
          ? Math.round(body.minPublishQualityScore)
          : undefined,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[workspaces/profile/PUT] mutation error:", err);
    return NextResponse.json({ error: "Failed to update workspace profile" }, { status: 500 });
  }
}
