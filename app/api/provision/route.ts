import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`provision:${userId}`, { limit: 20, windowSec: 3600 });
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

  let sessionId: string | undefined;
  let name = "My Workspace";
  try {
    const body = await request.json();
    sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
    if (typeof body.name === "string" && body.name.trim().length > 0) {
      name = body.name.trim().slice(0, 100);
    }
  } catch {
    // No body is fine — we'll still provision the workspace.
  }
  if (sessionId !== undefined && (sessionId.trim().length === 0 || sessionId.length > 128)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();
    const { workspaceId } = await convex.mutation(api.workspaces.provision, {
      name,
      sessionToken: sessionId?.trim() || undefined,
    });
    return NextResponse.json({ workspaceId }, { status: 200 });
  } catch (err) {
    console.error("[provision] mutation error:", err);
    return NextResponse.json(
      { error: "Failed to provision workspace" },
      { status: 500 }
    );
  }
}
