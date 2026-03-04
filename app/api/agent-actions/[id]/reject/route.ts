import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

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

  try {
    await convex.mutation(api.agentActions.reject, {
      actionId,
      userNote: body.note,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reject" },
      { status: 400 }
    );
  }
}
