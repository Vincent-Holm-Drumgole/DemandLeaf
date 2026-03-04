import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { briefDataModificationsValidator, briefDataValidator } from "./validators";
import {
  ERR_BRIEF_ALREADY_WRITTEN,
  ERR_BRIEF_NOT_FOUND,
  ERR_KEYWORD_ALREADY_BRIEFED,
  ERR_STRATEGY_NOT_FOUND,
  ERR_UNAUTHORIZED,
} from "./errors";

export const getById = query({
  args: { briefId: v.id("contentBriefs") },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new ConvexError(ERR_BRIEF_NOT_FOUND);
    await requireWorkspaceAccess(ctx, brief.workspaceId);
    return brief;
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("contentBriefs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(200);
  },
});

export const listByStrategy = query({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new ConvexError(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    return ctx.db
      .query("contentBriefs")
      .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
      .take(200);
  },
});

export const listByStrategyForCron = query({
  args: {
    strategyId: v.id("strategies"),
    workspaceId: v.optional(v.id("workspaces")),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new ConvexError(ERR_STRATEGY_NOT_FOUND);
    if (args.workspaceId && strategy.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }
    return ctx.db
      .query("contentBriefs")
      .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
      .take(200);
  },
});

export const getByIdForCron = query({
  args: {
    briefId: v.id("contentBriefs"),
    workspaceId: v.optional(v.id("workspaces")),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const brief = await ctx.db.get(args.briefId);
    if (!brief) return null;
    if (args.workspaceId && brief.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }
    return brief;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    keywordId: v.id("keywords"),
    briefData: briefDataValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword || keyword.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }

    // Prevent generating a second brief for the same keyword
    const existing = await ctx.db
      .query("contentBriefs")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .first();
    if (existing && existing.status !== "rejected") {
      throw new Error(`${ERR_KEYWORD_ALREADY_BRIEFED} a brief already exists for this keyword`);
    }

    const now = Date.now();
    return ctx.db.insert("contentBriefs", {
      workspaceId: args.workspaceId,
      strategyId: keyword.strategyId,
      keywordId: args.keywordId,
      briefData: args.briefData,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const approve = mutation({
  args: {
    briefId: v.id("contentBriefs"),
    modifications: v.optional(briefDataModificationsValidator),
  },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new ConvexError(ERR_BRIEF_NOT_FOUND);
    await requireWorkspaceAccess(ctx, brief.workspaceId);
    const keyword = await ctx.db.get(brief.keywordId);
    if (!keyword || keyword.workspaceId !== brief.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }
    await ctx.db.patch(args.briefId, {
      status: "approved",
      userModifications: args.modifications,
      updatedAt: Date.now(),
    });
    // Update keyword status to "briefed"
    await ctx.db.patch(brief.keywordId, { status: "briefed" });
  },
});

export const reject = mutation({
  args: {
    briefId: v.id("contentBriefs"),
  },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new ConvexError(ERR_BRIEF_NOT_FOUND);
    if (brief.status === "written") throw new ConvexError(ERR_BRIEF_ALREADY_WRITTEN);
    await requireWorkspaceAccess(ctx, brief.workspaceId);
    const keyword = await ctx.db.get(brief.keywordId);
    if (!keyword || keyword.workspaceId !== brief.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }
    await ctx.db.patch(args.briefId, {
      status: "rejected",
      updatedAt: Date.now(),
    });
    await ctx.db.patch(brief.keywordId, { status: "unassigned" });
  },
});

export const linkBlog = mutation({
  args: {
    briefId: v.id("contentBriefs"),
    blogId: v.id("blogs"),
  },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new ConvexError(ERR_BRIEF_NOT_FOUND);
    await requireWorkspaceAccess(ctx, brief.workspaceId);
    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== brief.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }
    await ctx.db.patch(args.briefId, {
      blogId: args.blogId,
      status: "written",
      updatedAt: Date.now(),
    });
    // Update keyword status atomically — avoids stale status if the caller
    // omits a separate assignToBlog call.
    await ctx.db.patch(brief.keywordId, {
      assignedBlogId: args.blogId,
      status: "written",
    });
  },
});

export const linkBlogForCron = mutation({
  args: {
    briefId: v.id("contentBriefs"),
    blogId: v.id("blogs"),
    workspaceId: v.optional(v.id("workspaces")),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new ConvexError(ERR_BRIEF_NOT_FOUND);
    const blog = await ctx.db.get(args.blogId);
    if (!blog) throw new ConvexError(ERR_UNAUTHORIZED);
    if (brief.workspaceId !== blog.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }
    if (args.workspaceId && brief.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }
    await ctx.db.patch(args.briefId, {
      blogId: args.blogId,
      status: "written",
      updatedAt: Date.now(),
    });
    await ctx.db.patch(brief.keywordId, {
      assignedBlogId: args.blogId,
      status: "written",
    });
  },
});
