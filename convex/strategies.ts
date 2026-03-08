import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "./errors";

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("strategies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(100);
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
      .query("strategies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(100);
  },
});

export const getById = query({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new ConvexError(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    return strategy;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    businessOutcomes: v.string(),
    targetAudience: v.optional(v.string()),
    seedKeywords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return ctx.db.insert("strategies", {
      workspaceId: args.workspaceId,
      name: args.name,
      businessOutcomes: args.businessOutcomes,
      targetAudience: args.targetAudience,
      seedKeywords: args.seedKeywords,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    strategyId: v.id("strategies"),
    name: v.optional(v.string()),
    businessOutcomes: v.optional(v.string()),
    targetAudience: v.optional(v.string()),
    seedKeywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new ConvexError(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.businessOutcomes !== undefined) patch.businessOutcomes = args.businessOutcomes;
    if (args.targetAudience !== undefined) patch.targetAudience = args.targetAudience;
    if (args.seedKeywords !== undefined) patch.seedKeywords = args.seedKeywords;
    await ctx.db.patch(args.strategyId, patch);
  },
});

export const archive = mutation({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new ConvexError(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    await ctx.db.patch(args.strategyId, {
      status: "archived" as const,
      updatedAt: Date.now(),
    });
  },
});

export const updateDriftCheckedAt = mutation({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new ConvexError(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    const now = Date.now();
    await ctx.db.patch(args.strategyId, {
      driftCheckedAt: now,
      updatedAt: now,
    });
  },
});

export const deleteWithCascade = mutation({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new ConvexError(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);

    const [keywords, clusters, briefs, calendar, competitors] = await Promise.all([
      ctx.db.query("keywords").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(500),
      ctx.db.query("topicClusters").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(100),
      ctx.db.query("contentBriefs").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(200),
      ctx.db.query("contentCalendar").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(500),
      ctx.db.query("competitorTracking").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(50),
    ]);

    await Promise.all([
      ...keywords.map((d) => ctx.db.delete(d._id)),
      ...clusters.map((d) => ctx.db.delete(d._id)),
      ...briefs.map((d) => ctx.db.delete(d._id)),
      ...calendar.map((d) => ctx.db.delete(d._id)),
      ...competitors.map((d) => ctx.db.delete(d._id)),
    ]);

    await ctx.db.delete(args.strategyId);
  },
});

export const clearDiscoveryData = mutation({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new ConvexError(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);

    const [keywords, clusters, briefs, calendar] = await Promise.all([
      ctx.db.query("keywords").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(500),
      ctx.db.query("topicClusters").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(100),
      ctx.db.query("contentBriefs").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(200),
      ctx.db.query("contentCalendar").withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId)).take(500),
    ]);

    await Promise.all([
      ...keywords.map((d) => ctx.db.delete(d._id)),
      ...clusters.map((d) => ctx.db.delete(d._id)),
      ...briefs.map((d) => ctx.db.delete(d._id)),
      ...calendar.map((d) => ctx.db.delete(d._id)),
    ]);

    await ctx.db.patch(args.strategyId, { updatedAt: Date.now() });
  },
});

// Internal query used by API routes that need workspace validation separately
export const getByIdInternal = query({
  args: { strategyId: v.id("strategies"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy || strategy.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }
    return strategy;
  },
});
