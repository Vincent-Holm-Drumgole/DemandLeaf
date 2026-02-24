import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import {
  ERR_BRIEF_NOT_FOUND,
  ERR_KEYWORD_ALREADY_BRIEFED,
  ERR_UNAUTHORIZED,
} from "./errors";

export const getById = query({
  args: { briefId: v.id("contentBriefs") },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new Error(ERR_BRIEF_NOT_FOUND);
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
      .collect();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    keywordId: v.id("keywords"),
    briefData: v.any(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword || keyword.workspaceId !== args.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
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
    modifications: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new Error(ERR_BRIEF_NOT_FOUND);
    await requireWorkspaceAccess(ctx, brief.workspaceId);
    const keyword = await ctx.db.get(brief.keywordId);
    if (!keyword || keyword.workspaceId !== brief.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
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
    if (!brief) throw new Error(ERR_BRIEF_NOT_FOUND);
    await requireWorkspaceAccess(ctx, brief.workspaceId);
    const keyword = await ctx.db.get(brief.keywordId);
    if (!keyword || keyword.workspaceId !== brief.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
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
    if (!brief) throw new Error(ERR_BRIEF_NOT_FOUND);
    await requireWorkspaceAccess(ctx, brief.workspaceId);
    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== brief.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
    }
    await ctx.db.patch(args.briefId, {
      blogId: args.blogId,
      status: "written",
      updatedAt: Date.now(),
    });
  },
});
