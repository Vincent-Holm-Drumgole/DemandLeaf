import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { agentTypeValidator } from "./validators";
import type { AgentType, TrustTier } from "../types/agents";

export const MAX_TRUST_AUDIT_ENTRIES = 500;
export const TRUSTED_MIN_DECISIONS = 20;
export const TRUSTED_MIN_RATE = 0.9;

async function computeTrustMetrics(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  agentType: AgentType,
) {
  const entries = await ctx.db
    .query("agentAuditLog")
    .withIndex("by_workspace_agent", (q) =>
      q.eq("workspaceId", workspaceId).eq("agentType", agentType)
    )
    .take(MAX_TRUST_AUDIT_ENTRIES);

  const decisions = entries.filter(
    (e) => (e.event === "approved" || e.event === "rejected") && e.actorType === "user"
  );
  const approvalCount = decisions.filter((e) => e.event === "approved").length;
  const rejectionCount = decisions.filter((e) => e.event === "rejected").length;
  const totalDecisions = approvalCount + rejectionCount;
  const approvalRate = totalDecisions > 0 ? approvalCount / totalDecisions : 0;

  return { approvalCount, rejectionCount, totalDecisions, approvalRate };
}

export const getTrustScore = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentType: agentTypeValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const { approvalCount, rejectionCount, totalDecisions, approvalRate } =
      await computeTrustMetrics(ctx, args.workspaceId, args.agentType);

    let trustTier: TrustTier = "learning";
    if (totalDecisions >= TRUSTED_MIN_DECISIONS && approvalRate >= TRUSTED_MIN_RATE) {
      trustTier = "trusted";
    } else if (totalDecisions >= 10) {
      trustTier = "established";
    }

    return {
      totalDecisions,
      approvalCount,
      rejectionCount,
      approvalRate: Math.round(approvalRate * 1000) / 1000,
      trustTier,
    };
  },
});

export const getPublishingGateStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const { approvalCount, approvalRate } =
      await computeTrustMetrics(ctx, args.workspaceId, "publishing");

    const config = await ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const configStatus = config?.status ?? "paused";
    const eligible =
      approvalCount >= TRUSTED_MIN_DECISIONS &&
      approvalRate >= TRUSTED_MIN_RATE &&
      configStatus === "active";

    return {
      eligible,
      approvalCount,
      approvalRate: Math.round(approvalRate * 1000) / 1000,
      configStatus,
    };
  },
});

export const getPublishingGateStatusForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);

    const { approvalCount, approvalRate } =
      await computeTrustMetrics(ctx, args.workspaceId, "publishing");

    const config = await ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const configStatus = config?.status ?? "paused";
    const eligible =
      approvalCount >= TRUSTED_MIN_DECISIONS &&
      approvalRate >= TRUSTED_MIN_RATE &&
      configStatus === "active";

    return {
      eligible,
      approvalCount,
      approvalRate: Math.round(approvalRate * 1000) / 1000,
      configStatus,
    };
  },
});
