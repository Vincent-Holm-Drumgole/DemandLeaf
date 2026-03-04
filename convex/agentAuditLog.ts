import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";

const MAX_AUDIT_PER_ACTION = 50;
const MAX_AUDIT_PER_WORKSPACE = 200;
const MAX_AUDIT_FOR_CRON = 500;

export const listByAction = query({
  args: { agentActionId: v.id("agentActions") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.agentActionId);
    if (!action) return [];
    await requireWorkspaceAccess(ctx, action.workspaceId);
    return ctx.db
      .query("agentAuditLog")
      .withIndex("by_agent_action", (q) =>
        q.eq("agentActionId", args.agentActionId)
      )
      .order("desc")
      .take(MAX_AUDIT_PER_ACTION);
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("agentAuditLog")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(MAX_AUDIT_PER_WORKSPACE);
  },
});

export const listByWorkspaceForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("agentAuditLog")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(MAX_AUDIT_FOR_CRON);
  },
});
