import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { ERR_BLOG_NOT_FOUND } from "./errors";

const MAX_METRICS_PER_BLOG = 200;
const MAX_METRICS_PER_WORKSPACE = 500;

export const upsertMetrics = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    sessions: v.optional(v.number()),
    pageviews: v.optional(v.number()),
    avgEngagementTimeSec: v.optional(v.number()),
    bounceRate: v.optional(v.number()),
    clicks: v.optional(v.number()),
    impressions: v.optional(v.number()),
    ctr: v.optional(v.number()),
    avgPosition: v.optional(v.number()),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }

    const existing = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_blog_period", (q) =>
        q.eq("blogId", args.blogId).eq("periodStart", args.periodStart)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, measuredAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("performanceMetrics", {
      ...args,
      measuredAt: Date.now(),
    });
  },
});

export const upsertMetricsForCron = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    sessions: v.optional(v.number()),
    pageviews: v.optional(v.number()),
    avgEngagementTimeSec: v.optional(v.number()),
    bounceRate: v.optional(v.number()),
    clicks: v.optional(v.number()),
    impressions: v.optional(v.number()),
    ctr: v.optional(v.number()),
    avgPosition: v.optional(v.number()),
    periodStart: v.number(),
    periodEnd: v.number(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const { cronKey, ...fields } = args;
    void cronKey;

    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }

    const existing = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_blog_period", (q) =>
        q.eq("blogId", args.blogId).eq("periodStart", args.periodStart)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, measuredAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("performanceMetrics", {
      ...fields,
      measuredAt: Date.now(),
    });
  },
});

export const getMetricsForBlog = query({
  args: {
    blogId: v.id("blogs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const blog = await ctx.db.get(args.blogId);
    if (!blog) throw new ConvexError(ERR_BLOG_NOT_FOUND);
    await requireWorkspaceAccess(ctx, blog.workspaceId);
    return ctx.db
      .query("performanceMetrics")
      .withIndex("by_blog_period", (q) => q.eq("blogId", args.blogId))
      .order("desc")
      .take(args.limit ?? MAX_METRICS_PER_BLOG);
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
      .query("performanceMetrics")
      .withIndex("by_workspace_period", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("periodStart", args.since)
      )
      .order("desc")
      .take(MAX_METRICS_PER_WORKSPACE);
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
      .query("performanceMetrics")
      .withIndex("by_workspace_period", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("periodStart", args.since)
      )
      .order("desc")
      .take(MAX_METRICS_PER_WORKSPACE);
  },
});
