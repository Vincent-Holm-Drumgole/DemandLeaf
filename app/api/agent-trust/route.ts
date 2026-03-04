import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

const VALID_AGENT_TYPES = [
  "calendar",
  "refresh",
  "internal_links",
  "competitive_response",
  "strategy_drift",
  "publishing",
] as const;

type AgentType = (typeof VALID_AGENT_TYPES)[number];

function isAgentType(value: string): value is AgentType {
  return (VALID_AGENT_TYPES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agentType = searchParams.get("agentType");

  try {
    const convex = await getAuthedConvexClient();
    const workspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (agentType === "publishing") {
      const gate = await convex.query(api.agentTrust.getPublishingGateStatus, {
        workspaceId: workspace._id,
      });
      return NextResponse.json(gate);
    }

    if (agentType) {
      if (!isAgentType(agentType)) {
        return NextResponse.json({ error: "Invalid agentType" }, { status: 400 });
      }
      const score = await convex.query(api.agentTrust.getTrustScore, {
        workspaceId: workspace._id,
        agentType,
      });
      return NextResponse.json(score);
    }

    return NextResponse.json({ error: "agentType param required" }, { status: 400 });
  } catch (err) {
    console.error("[agent-trust/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch trust data" },
      { status: 500 }
    );
  }
}
