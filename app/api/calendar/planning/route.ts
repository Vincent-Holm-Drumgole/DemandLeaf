import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const planning = await convex.query(api.contentCalendar.getPlanningOverview, {
      workspaceId: workspace._id,
    });
    return NextResponse.json(planning);
  } catch (error) {
    console.error("[calendar/planning] Failed to fetch planning overview:", error);
    return NextResponse.json({ error: "Failed to load planning data" }, { status: 500 });
  }
}
