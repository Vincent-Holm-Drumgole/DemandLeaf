import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import {
  ERR_AGENT_ACTION_NOT_FOUND,
  ERR_AGENT_ACTION_NOT_PENDING,
} from "@/convex/errors";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const actionId = parseConvexId(id, "agentActions");
  if (!actionId) {
    return NextResponse.json({ error: "Invalid action ID" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    note?: string;
  };

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace required" }, { status: 403 });
  }

  try {
    await convex.mutation(api.agentActions.reject, {
      actionId,
      userNote: body.note,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reject";
    const status = message.includes(ERR_AGENT_ACTION_NOT_FOUND)
      ? 404
      : message.includes(ERR_AGENT_ACTION_NOT_PENDING)
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
