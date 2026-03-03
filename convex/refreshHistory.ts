import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_REFRESH_NOT_FOUND } from "./errors";
import { refreshBriefDataValidator, refreshStatusValidator } from "./validators";

const MAX_REFRESH_PER_BLOG = 20;
const MAX_REFRESH_PER_WORKSPACE = 50;

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    alertId: v.optional(v.id("decayAlerts")),
    briefData: refreshBriefDataValidator,
    status: refreshStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return ctx.db.insert("refreshHistory", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateContent = mutation({
  args: {
    refreshId: v.id("refreshHistory"),
    refreshedContent: v.string(),
    status: refreshStatusValidator,
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.refreshId);
    if (!record) throw new ConvexError(ERR_REFRESH_NOT_FOUND);
    await requireWorkspaceAccess(ctx, record.workspaceId);
    await ctx.db.patch(args.refreshId, {
      refreshedContent: args.refreshedContent,
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    refreshId: v.id("refreshHistory"),
    status: refreshStatusValidator,
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.refreshId);
    if (!record) throw new ConvexError(ERR_REFRESH_NOT_FOUND);
    await requireWorkspaceAccess(ctx, record.workspaceId);
    await ctx.db.patch(args.refreshId, {
      status: args.status,
      ...(args.failureReason && { failureReason: args.failureReason }),
      updatedAt: Date.now(),
    });
  },
});

export const listByBlog = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    const blog = await ctx.db.get(args.blogId);
    if (!blog) return [];
    await requireWorkspaceAccess(ctx, blog.workspaceId);
    return ctx.db
      .query("refreshHistory")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .take(MAX_REFRESH_PER_BLOG);
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("refreshHistory")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .take(MAX_REFRESH_PER_WORKSPACE);
  },
});

export const getById = query({
  args: { refreshId: v.id("refreshHistory") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.refreshId);
    if (!record) return null;
    await requireWorkspaceAccess(ctx, record.workspaceId);
    return record;
  },
});
