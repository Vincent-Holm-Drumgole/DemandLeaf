import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const entryId = parseConvexId(id, "neverSayList");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  void _request;

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await convex.mutation(api.neverSayList.remove, {
      entryId,
      workspaceId: workspace._id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Entry not found")) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    console.error("[never-say/[id]/DELETE] error:", err);
    return NextResponse.json({ error: "Failed to delete term" }, { status: 500 });
  }
}

