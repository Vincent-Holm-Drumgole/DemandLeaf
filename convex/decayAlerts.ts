import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { ERR_DECAY_ALERT_NOT_FOUND } from "./errors";
import {
  decayAlertTypeValidator,
  decayAlertSeverityValidator,
  decayAlertStatusValidator,
  diagnosisCauseValidator,
} from "./validators";

const MAX_ALERTS = 200;
const MAX_ALERTS_PER_BLOG = 50;

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    alertType: decayAlertTypeValidator,
    severity: decayAlertSeverityValidator,
    baselineValue: v.number(),
    currentValue: v.number(),
    deltaPercent: v.number(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db.insert("decayAlerts", {
      ...args,
      triggeredAt: Date.now(),
      status: "open",
    });
  },
});

export const createForCron = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    alertType: decayAlertTypeValidator,
    severity: decayAlertSeverityValidator,
    baselineValue: v.number(),
    currentValue: v.number(),
    deltaPercent: v.number(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const { cronKey, ...fields } = args;
    void cronKey;
    return ctx.db.insert("decayAlerts", {
      ...fields,
      triggeredAt: Date.now(),
      status: "open",
    });
  },
});

function buildStatusPatch(args: {
  status: string;
  diagnosisCause?: string;
  diagnosisNotes?: string;
  refreshHistoryId?: string;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = { status: args.status };
  if (args.diagnosisCause) {
    patch.diagnosisCause = args.diagnosisCause;
    patch.diagnosedAt = Date.now();
  }
  if (args.diagnosisNotes) patch.diagnosisNotes = args.diagnosisNotes;
  if (args.refreshHistoryId) patch.refreshHistoryId = args.refreshHistoryId;
  if (args.status === "resolved") patch.resolvedAt = Date.now();
  if (args.status === "escalated") patch.escalatedAt = Date.now();
  return patch;
}

export const updateStatus = mutation({
  args: {
    alertId: v.id("decayAlerts"),
    status: decayAlertStatusValidator,
    diagnosisCause: v.optional(diagnosisCauseValidator),
    diagnosisNotes: v.optional(v.string()),
    refreshHistoryId: v.optional(v.id("refreshHistory")),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new ConvexError(ERR_DECAY_ALERT_NOT_FOUND);
    await requireWorkspaceAccess(ctx, alert.workspaceId);

    await ctx.db.patch(args.alertId, buildStatusPatch(args));
  },
});

export const listOpenByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("decayAlerts")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "open")
      )
      .take(MAX_ALERTS);
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("decayAlerts")
      .withIndex("by_workspace_triggered", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .order("desc")
      .take(MAX_ALERTS);
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
      .query("decayAlerts")
      .withIndex("by_workspace_triggered", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .order("desc")
      .take(MAX_ALERTS);
  },
});

export const listByBlog = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    const blog = await ctx.db.get(args.blogId);
    if (!blog) return [];
    await requireWorkspaceAccess(ctx, blog.workspaceId);
    return ctx.db
      .query("decayAlerts")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .take(MAX_ALERTS_PER_BLOG);
  },
});

export const getById = query({
  args: { alertId: v.id("decayAlerts") },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) return null;
    await requireWorkspaceAccess(ctx, alert.workspaceId);
    return alert;
  },
});

export const updateStatusForCron = mutation({
  args: {
    alertId: v.id("decayAlerts"),
    status: decayAlertStatusValidator,
    diagnosisCause: v.optional(diagnosisCauseValidator),
    diagnosisNotes: v.optional(v.string()),
    refreshHistoryId: v.optional(v.id("refreshHistory")),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new ConvexError(ERR_DECAY_ALERT_NOT_FOUND);

    await ctx.db.patch(args.alertId, buildStatusPatch(args));
  },
});
