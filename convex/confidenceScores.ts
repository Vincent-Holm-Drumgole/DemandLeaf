import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_BLOG_NOT_FOUND, ERR_INVALID_VOICE_MATCH_SCORE } from "./errors";

const MAX_TREND_BLOGS = 5_000;

export const approveBlog = mutation({
  args: {
    blogId: v.id("blogs"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }
    await ctx.db.patch(args.blogId, {
      userApproval: true,
      updatedAt: Date.now(),
    });
  },
});

export const setVoiceMatchScore = mutation({
  args: {
    blogId: v.id("blogs"),
    workspaceId: v.id("workspaces"),
    voiceMatchScore: v.number(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    if (args.voiceMatchScore < 0 || args.voiceMatchScore > 100) {
      throw new ConvexError(ERR_INVALID_VOICE_MATCH_SCORE);
    }
    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }
    await ctx.db.patch(args.blogId, {
      voiceMatchScore: args.voiceMatchScore,
      updatedAt: Date.now(),
    });
  },
});

export const getWorkspaceTrend = query({
  args: {
    workspaceId: v.id("workspaces"),
    windowDays: v.number(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const windowDays = Math.max(1, Math.min(args.windowDays, 365));
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const recentBlogs = await ctx.db
      .query("blogs")
      .withIndex("by_workspace_created", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("createdAt", cutoff)
      )
      .order("desc")
      .take(MAX_TREND_BLOGS);
    const truncated = recentBlogs.length === MAX_TREND_BLOGS;
    const blogs = [...recentBlogs].reverse();

    if (blogs.length === 0) {
      return {
        trend: [],
        summary: {
          avgVoiceMatchScore: null,
          approvalRate: null,
          avgEditRatio: null,
          totalBlogs: 0,
          truncated: false,
        },
      };
    }

    const trend = blogs.map((b) => ({
      date: new Date(b.createdAt).toISOString().split("T")[0],
      voiceMatchScore: b.voiceMatchScore ?? null,
      userApproval: b.userApproval ?? null,
      editRatio: b.editRatio ?? null,
    }));

    const withVoice = blogs.filter((b) => b.voiceMatchScore != null);
    const withApproval = blogs.filter((b) => b.userApproval != null);
    const withEdits = blogs.filter((b) => b.editRatio != null);

    const avgVoiceMatchScore =
      withVoice.length > 0
        ? withVoice.reduce((s, b) => s + (b.voiceMatchScore ?? 0), 0) / withVoice.length
        : null;

    const approvalRate =
      withApproval.length > 0
        ? (withApproval.filter((b) => b.userApproval).length / withApproval.length) * 100
        : null;

    const avgEditRatio =
      withEdits.length > 0
        ? withEdits.reduce((s, b) => s + (b.editRatio ?? 0), 0) / withEdits.length
        : null;

    return {
      trend,
      summary: {
        avgVoiceMatchScore,
        approvalRate,
        avgEditRatio,
        totalBlogs: blogs.length,
        truncated,
      },
    };
  },
});
