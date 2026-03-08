import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { ERR_NOTIFICATION_NOT_FOUND } from "./errors";
import { notificationTypeValidator } from "./validators";

const MAX_NOTIFICATIONS = 50;

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    // Get unread first, then read, ordered by newest
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_workspace_read", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("read", false)
      )
      .order("desc")
      .take(MAX_NOTIFICATIONS);

    const remaining = MAX_NOTIFICATIONS - unread.length;
    if (remaining <= 0) return unread;

    const read = await ctx.db
      .query("notifications")
      .withIndex("by_workspace_read", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("read", true)
      )
      .order("desc")
      .take(remaining);

    return [...unread, ...read];
  },
});

export const getUnreadCount = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_workspace_read", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("read", false)
      )
      .take(MAX_NOTIFICATIONS);
    return unread.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new ConvexError(ERR_NOTIFICATION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, notif.workspaceId);
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

export const markAllRead = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_workspace_read", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("read", false)
      )
      .take(MAX_NOTIFICATIONS);

    await Promise.all(
      unread.map((n) => ctx.db.patch(n._id, { read: true }))
    );
  },
});

export const createForCron = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: notificationTypeValidator,
    title: v.string(),
    body: v.string(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const { cronKey, ...fields } = args;
    void cronKey;
    return ctx.db.insert("notifications", {
      ...fields,
      agentType: undefined,
      read: false,
      createdAt: Date.now(),
    });
  },
});
