import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { agentTypeValidator } from "./validators";
import type { TrustTier } from "../types/agents";

const MAX_AUDIT_ENTRIES = 500;
const TRUSTED_MIN_DECISIONS = 20;
const TRUSTED_MIN_RATE = 0.9;

export const getTrustScore = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentType: agentTypeValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entries = await ctx.db
      .query("agentAuditLog")
      .withIndex("by_workspace_agent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("agentType", args.agentType)
      )
      .take(MAX_AUDIT_ENTRIES);

    const decisions = entries.filter(
      (e) => (e.event === "approved" || e.event === "rejected") && e.actorType === "user"
    );
    const approvalCount = decisions.filter((e) => e.event === "approved").length;
    const rejectionCount = decisions.filter((e) => e.event === "rejected").length;
    const totalDecisions = approvalCount + rejectionCount;
    const approvalRate = totalDecisions > 0 ? approvalCount / totalDecisions : 0;

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

    // Get trust score for publishing agent type
    const entries = await ctx.db
      .query("agentAuditLog")
      .withIndex("by_workspace_agent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("agentType", "publishing")
      )
      .take(MAX_AUDIT_ENTRIES);

    const decisions = entries.filter(
      (e) => (e.event === "approved" || e.event === "rejected") && e.actorType === "user"
    );
    const approvalCount = decisions.filter((e) => e.event === "approved").length;
    const totalDecisions = approvalCount + decisions.filter((e) => e.event === "rejected").length;
    const approvalRate = totalDecisions > 0 ? approvalCount / totalDecisions : 0;

    // Check config
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

    const entries = await ctx.db
      .query("agentAuditLog")
      .withIndex("by_workspace_agent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("agentType", "publishing")
      )
      .take(MAX_AUDIT_ENTRIES);

    const decisions = entries.filter(
      (e) => (e.event === "approved" || e.event === "rejected") && e.actorType === "user"
    );
    const approvalCount = decisions.filter((e) => e.event === "approved").length;
    const totalDecisions = decisions.length;
    const approvalRate = totalDecisions > 0 ? approvalCount / totalDecisions : 0;

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
