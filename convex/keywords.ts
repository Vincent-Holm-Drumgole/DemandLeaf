import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_KEYWORD_NOT_FOUND, ERR_UNAUTHORIZED } from "./errors";
import type { Id } from "./_generated/dataModel";
import {
  buyerStageValidator,
  keywordStatusValidator,
  searchIntentValidator,
} from "./validators";

export const listByStrategy = query({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) return [];
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    return ctx.db
      .query("keywords")
      .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
      .collect();
  },
});

export const listByCluster = query({
  args: { clusterId: v.id("topicClusters") },
  handler: async (ctx, args) => {
    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) return [];
    await requireWorkspaceAccess(ctx, cluster.workspaceId);
    return ctx.db
      .query("keywords")
      .withIndex("by_cluster", (q) => q.eq("clusterId", args.clusterId))
      .collect();
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const getById = query({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
    const kw = await ctx.db.get(args.keywordId);
    if (!kw) throw new Error(ERR_KEYWORD_NOT_FOUND);
    await requireWorkspaceAccess(ctx, kw.workspaceId);
    return kw;
  },
});

export const bulkCreate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    keywords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy || strategy.workspaceId !== args.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
    }

    const now = Date.now();
    const ids: Array<Id<"keywords">> = [];
    for (const keyword of args.keywords) {
      const normalizedKeyword = keyword.trim();
      if (!normalizedKeyword) {
        continue;
      }

      const existing = await ctx.db
        .query("keywords")
        .withIndex("by_strategy_keyword", (q) =>
          q.eq("strategyId", args.strategyId).eq("keyword", normalizedKeyword),
        )
        .first();
      if (existing) {
        ids.push(existing._id);
        continue;
      }

      const id = await ctx.db.insert("keywords", {
        workspaceId: args.workspaceId,
        strategyId: args.strategyId,
        keyword: normalizedKeyword,
        status: "unassigned",
        createdAt: now,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const updateMetrics = mutation({
  args: {
    keywordId: v.id("keywords"),
    searchVolume: v.number(),
    keywordDifficulty: v.number(),
    cpc: v.number(),
    opportunityScore: v.number(),
    searchIntent: v.optional(searchIntentValidator),
    buyerStage: v.optional(buyerStageValidator),
  },
  handler: async (ctx, args) => {
    const kw = await ctx.db.get(args.keywordId);
    if (!kw) throw new Error(ERR_KEYWORD_NOT_FOUND);
    await requireWorkspaceAccess(ctx, kw.workspaceId);
    await ctx.db.patch(args.keywordId, {
      searchVolume: args.searchVolume,
      keywordDifficulty: args.keywordDifficulty,
      cpc: args.cpc,
      opportunityScore: args.opportunityScore,
      searchIntent: args.searchIntent,
      buyerStage: args.buyerStage,
      dataFetchedAt: Date.now(),
    });
  },
});

export const updateCluster = mutation({
  args: {
    keywordId: v.id("keywords"),
    clusterId: v.id("topicClusters"),
  },
  handler: async (ctx, args) => {
    const kw = await ctx.db.get(args.keywordId);
    if (!kw) throw new Error(ERR_KEYWORD_NOT_FOUND);
    await requireWorkspaceAccess(ctx, kw.workspaceId);
    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster || cluster.workspaceId !== kw.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
    }
    await ctx.db.patch(args.keywordId, { clusterId: args.clusterId });
  },
});

export const updateStatus = mutation({
  args: {
    keywordId: v.id("keywords"),
    status: keywordStatusValidator,
  },
  handler: async (ctx, args) => {
    const kw = await ctx.db.get(args.keywordId);
    if (!kw) throw new Error(ERR_KEYWORD_NOT_FOUND);
    await requireWorkspaceAccess(ctx, kw.workspaceId);
    await ctx.db.patch(args.keywordId, { status: args.status });
  },
});

export const assignToBlog = mutation({
  args: {
    keywordId: v.id("keywords"),
    blogId: v.id("blogs"),
  },
  handler: async (ctx, args) => {
    const kw = await ctx.db.get(args.keywordId);
    if (!kw) throw new Error(ERR_KEYWORD_NOT_FOUND);
    await requireWorkspaceAccess(ctx, kw.workspaceId);
    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== kw.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
    }
    await ctx.db.patch(args.keywordId, {
      assignedBlogId: args.blogId,
      status: "written",
    });
  },
});
