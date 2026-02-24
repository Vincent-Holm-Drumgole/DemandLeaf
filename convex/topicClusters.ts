import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_UNAUTHORIZED } from "./errors";
import type { Id } from "./_generated/dataModel";

export const listByStrategy = query({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) return [];
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    return ctx.db
      .query("topicClusters")
      .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
      .collect();
  },
});

export const bulkCreate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    clusters: v.array(
      v.object({
        name: v.string(),
        pillarKeyword: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy || strategy.workspaceId !== args.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
    }

    const existingClusters = await ctx.db
      .query("topicClusters")
      .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
      .collect();

    if (existingClusters.length > 0) {
      const existingKeywords = await ctx.db
        .query("keywords")
        .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
        .collect();

      await Promise.all(
        existingKeywords
          .filter((keyword) => keyword.clusterId !== undefined)
          .map((keyword) => ctx.db.patch(keyword._id, { clusterId: undefined })),
      );

      await Promise.all(existingClusters.map((cluster) => ctx.db.delete(cluster._id)));
    }

    const now = Date.now();
    const ids: Array<Id<"topicClusters">> = [];
    for (const cluster of args.clusters) {
      const id = await ctx.db.insert("topicClusters", {
        workspaceId: args.workspaceId,
        strategyId: args.strategyId,
        name: cluster.name,
        pillarKeyword: cluster.pillarKeyword,
        createdAt: now,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const setPillarBlog = mutation({
  args: {
    clusterId: v.id("topicClusters"),
    pillarBlogId: v.id("blogs"),
  },
  handler: async (ctx, args) => {
    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) return;
    await requireWorkspaceAccess(ctx, cluster.workspaceId);
    const blog = await ctx.db.get(args.pillarBlogId);
    if (!blog || blog.workspaceId !== cluster.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
    }
    await ctx.db.patch(args.clusterId, { pillarBlogId: args.pillarBlogId });
  },
});
