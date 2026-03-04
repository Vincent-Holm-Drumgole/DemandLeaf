import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireWorkspaceAccess, requireCronAccess } from "./helpers";
import { ERR_PUBLISHING_CONFIG_NOT_FOUND } from "./errors";

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});

export const getByWorkspaceForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});

export const activate = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const existing = await ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        pauseReason: undefined,
        pausedAt: undefined,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("publishingAgentConfig", {
        workspaceId: args.workspaceId,
        status: "active",
        updatedAt: Date.now(),
      });
    }
  },
});

export const pause = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    reason: v.string(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const existing = await ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!existing) throw new ConvexError(ERR_PUBLISHING_CONFIG_NOT_FOUND);
    await ctx.db.patch(existing._id, {
      status: "paused",
      pauseReason: args.reason,
      pausedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const pauseByUser = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const existing = await ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("publishingAgentConfig", {
        workspaceId: args.workspaceId,
        status: "paused",
        pauseReason: args.reason,
        pausedAt: now,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      status: "paused",
      pauseReason: args.reason,
      pausedAt: now,
      updatedAt: now,
    });
  },
});

export const resume = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const existing = await ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!existing) throw new ConvexError(ERR_PUBLISHING_CONFIG_NOT_FOUND);
    await ctx.db.patch(existing._id, {
      status: "active",
      pauseReason: undefined,
      pausedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});
