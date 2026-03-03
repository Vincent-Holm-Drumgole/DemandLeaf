import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";

const MAX_SNAPSHOTS_PER_QUERY = 100;
const MAX_WORKSPACE_SNAPSHOTS = 500;

export const insertSnapshot = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    keyword: v.string(),
    position: v.optional(v.number()),
    url: v.optional(v.string()),
    searchVolume: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db.insert("rankSnapshots", {
      ...args,
      checkedAt: Date.now(),
    });
  },
});

export const insertSnapshotForCron = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    keyword: v.string(),
    position: v.optional(v.number()),
    url: v.optional(v.string()),
    searchVolume: v.optional(v.number()),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const { cronKey: _cronKey, ...fields } = args;
    return ctx.db.insert("rankSnapshots", {
      ...fields,
      checkedAt: Date.now(),
    });
  },
});

export const getSnapshotsForBlog = query({
  args: {
    blogId: v.id("blogs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const blog = await ctx.db.get(args.blogId);
    if (!blog) return [];
    await requireWorkspaceAccess(ctx, blog.workspaceId);
    return ctx.db
      .query("rankSnapshots")
      .withIndex("by_blog_checked", (q) => q.eq("blogId", args.blogId))
      .order("desc")
      .take(args.limit ?? MAX_SNAPSHOTS_PER_QUERY);
  },
});

export const getRecentForWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("rankSnapshots")
      .withIndex("by_workspace_checked", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("checkedAt", args.since)
      )
      .take(MAX_WORKSPACE_SNAPSHOTS);
  },
});

export const getRecentForWorkspaceForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    since: v.number(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("rankSnapshots")
      .withIndex("by_workspace_checked", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("checkedAt", args.since)
      )
      .take(MAX_WORKSPACE_SNAPSHOTS);
  },
});
