import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import {
  ERR_BATCH_TOO_LARGE,
  ERR_BLOG_NOT_FOUND,
  ERR_INTERNAL_LINK_NOT_FOUND,
} from "./errors";
import { internalLinkStatusValidator } from "./validators";

const MAX_LINKS_PER_BLOG = 10;

export const listByBlog = query({
  args: { sourceBlogId: v.id("blogs") },
  handler: async (ctx, args) => {
    const blog = await ctx.db.get(args.sourceBlogId);
    if (!blog) return [];
    await requireWorkspaceAccess(ctx, blog.workspaceId);
    return ctx.db
      .query("internalLinks")
      .withIndex("by_source_blog", (q) =>
        q.eq("sourceBlogId", args.sourceBlogId)
      )
      .take(MAX_LINKS_PER_BLOG);
  },
});

export const upsertSuggestions = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceBlogId: v.id("blogs"),
    suggestions: v.array(
      v.object({
        targetBlogId: v.id("blogs"),
        anchorText: v.string(),
        similarity: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    if (args.suggestions.length > MAX_LINKS_PER_BLOG) {
      throw new ConvexError(ERR_BATCH_TOO_LARGE);
    }

    const sourceBlog = await ctx.db.get(args.sourceBlogId);
    if (!sourceBlog || sourceBlog.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }

    const uniqueTargetBlogIds = [...new Set(args.suggestions.map((s) => s.targetBlogId))];
    const targetBlogs = await Promise.all(
      uniqueTargetBlogIds.map((targetBlogId) => ctx.db.get(targetBlogId))
    );
    const hasInvalidTarget = targetBlogs.some(
      (targetBlog, index) =>
        !targetBlog ||
        targetBlog.workspaceId !== args.workspaceId ||
        uniqueTargetBlogIds[index] === args.sourceBlogId
    );
    if (hasInvalidTarget) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }

    const existing = await ctx.db
      .query("internalLinks")
      .withIndex("by_source_blog", (q) =>
        q.eq("sourceBlogId", args.sourceBlogId)
      )
      .take(MAX_LINKS_PER_BLOG);

    await Promise.all(existing.map((l) => ctx.db.delete(l._id)));

    const now = Date.now();
    await Promise.all(
      args.suggestions.map((s) =>
        ctx.db.insert("internalLinks", {
          workspaceId: args.workspaceId,
          sourceBlogId: args.sourceBlogId,
          targetBlogId: s.targetBlogId,
          anchorText: s.anchorText,
          similarity: s.similarity,
          status: "suggested",
          createdAt: now,
        })
      )
    );
  },
});

export const updateStatus = mutation({
  args: {
    linkId: v.id("internalLinks"),
    status: internalLinkStatusValidator,
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) throw new ConvexError(ERR_INTERNAL_LINK_NOT_FOUND);
    await requireWorkspaceAccess(ctx, link.workspaceId);
    await ctx.db.patch(args.linkId, { status: args.status });
  },
});
