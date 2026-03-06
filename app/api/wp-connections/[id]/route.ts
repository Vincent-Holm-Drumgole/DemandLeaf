import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const connectionId = parseConvexId(id, "wpConnections");
  if (!connectionId) {
    return NextResponse.json({ error: "Invalid connection ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace required" }, { status: 403 });
  }

  try {
    await convex.mutation(api.wpConnections.remove, { connectionId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[wp-connections/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
