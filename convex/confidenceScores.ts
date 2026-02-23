import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const approveBlog = mutation({
  args: {
    blogId: v.id("blogs"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new Error("Blog not found");
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
    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new Error("Blog not found");
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
    const cutoff = Date.now() - args.windowDays * 24 * 60 * 60 * 1000;
    const blogs = await ctx.db
      .query("blogs")
      .withIndex("by_workspace_created", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .filter((q) => q.gte(q.field("createdAt"), cutoff))
      .order("asc")
      .collect();

    if (blogs.length === 0) {
      return {
        trend: [],
        summary: {
          avgVoiceMatchScore: null,
          approvalRate: null,
          avgEditRatio: null,
          totalBlogs: 0,
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
      },
    };
  },
});
