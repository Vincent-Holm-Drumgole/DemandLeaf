import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sessionId: string | undefined;
  try {
    const body = await request.json();
    sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
  } catch {
    // No body is fine — we'll still provision the workspace.
  }

  try {
    const convex = await getAuthedConvexClient();
    const { workspaceId } = await convex.mutation(api.workspaces.provision, {
      clerkUserId: userId,
      name: "My Workspace",
      sessionToken: sessionId,
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
