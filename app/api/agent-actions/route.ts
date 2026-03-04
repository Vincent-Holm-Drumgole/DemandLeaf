import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

const VALID_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "executing",
  "done",
  "failed",
] as const;
const VALID_AGENT_TYPES = [
  "calendar",
  "refresh",
  "internal_links",
  "competitive_response",
  "strategy_drift",
  "publishing",
] as const;

type AgentActionStatus = (typeof VALID_STATUSES)[number];
type AgentType = (typeof VALID_AGENT_TYPES)[number];

function isAgentActionStatus(value: string): value is AgentActionStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

function isAgentType(value: string): value is AgentType {
  return (VALID_AGENT_TYPES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`agent-actions:${userId}`, {
    limit: 60,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const agentTypeParam = searchParams.get("agentType");

  if (statusParam && !isAgentActionStatus(statusParam)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }
  if (agentTypeParam && !isAgentType(agentTypeParam)) {
    return NextResponse.json({ error: "Invalid agentType filter" }, { status: 400 });
  }

  const status = (statusParam as AgentActionStatus) || undefined;
  const agentType = (agentTypeParam as AgentType) || undefined;

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const actions = await convex.query(api.agentActions.listByWorkspace, {
    workspaceId: workspace._id,
    status,
    agentType,
  });

  return NextResponse.json(
    actions.map((action) => ({
      id: action._id,
      agentType: action.agentType,
      status: action.status,
      payload: action.payload,
      reasoning: action.reasoning,
      suggestedAt: action.suggestedAt,
      decidedAt: action.decidedAt ?? null,
      executedAt: action.executedAt ?? null,
      userNote: action.userNote ?? null,
    }))
  );
}
