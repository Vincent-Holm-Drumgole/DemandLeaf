import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { executeCalendarChanges } from "@/lib/agents/executors/calendar-executor";
import { executeRefresh } from "@/lib/agents/executors/refresh-executor";
import { executeInternalLinks } from "@/lib/agents/executors/internal-links-executor";
import { executeCompetitiveResponse } from "@/lib/agents/executors/competitive-response-executor";
import { executeStrategyDrift } from "@/lib/agents/executors/strategy-drift-executor";
import { executePublishing } from "@/lib/agents/executors/publishing-executor";
import type {
  CalendarAgentPayload,
  RefreshAgentPayload,
  InternalLinksAgentPayload,
  CompetitiveResponsePayload,
  StrategyDriftPayload,
  PublishingAgentPayload,
} from "@/types";

export async function POST(
  _request: Request,
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

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Approve in Convex first (validates status === "pending")
  try {
    await convex.mutation(api.agentActions.approve, { actionId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to approve" },
      { status: 400 }
    );
  }

  // Load the action to get payload and agentType
  const action = await convex.query(api.agentActions.getById, { actionId });
  if (!action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  // Execute the action based on agent type
  try {
    let result: unknown;
    switch (action.agentType) {
      case "calendar":
        result = await executeCalendarChanges(
          convex,
          action.payload as CalendarAgentPayload
        );
        break;
      case "refresh":
        result = await executeRefresh(
          convex,
          workspace._id,
          action.payload as RefreshAgentPayload
        );
        break;
      case "internal_links":
        result = await executeInternalLinks(
          convex,
          workspace._id,
          action.payload as InternalLinksAgentPayload
        );
        break;
      case "competitive_response":
        result = await executeCompetitiveResponse(
          convex,
          workspace._id,
          action.payload as CompetitiveResponsePayload
        );
        break;
      case "strategy_drift":
        result = await executeStrategyDrift(
          convex,
          workspace._id,
          action.payload as StrategyDriftPayload
        );
        break;
      case "publishing":
        result = await executePublishing(
          convex,
          workspace._id,
          action.payload as PublishingAgentPayload
        );
        break;
    }

    try {
      await convex.mutation(api.agentActions.markDoneByUser, {
        actionId,
      });
    } catch (markErr) {
      console.error("[agent-actions/approve] Failed to mark action done:", markErr);
    }

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[agent-actions/approve] Execution failed:", err);
    try {
      const reason = err instanceof Error ? err.message : "Execution failed";
      await convex.mutation(api.agentActions.markFailedByUser, {
        actionId,
        failureReason: reason.slice(0, 500),
      });
    } catch (markErr) {
      console.error("[agent-actions/approve] Failed to mark action failed:", markErr);
    }
    return NextResponse.json(
      { error: "Execution failed", detail: err instanceof Error ? err.message : "" },
      { status: 500 }
    );
  }
}
