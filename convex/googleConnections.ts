import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { ERR_GOOGLE_CONNECTION_NOT_FOUND } from "./errors";
import { googleConnectionStatusValidator } from "./validators";

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("googleConnections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});

export const getByWorkspaceForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("googleConnections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    encryptedTokens: v.string(),
    tokenIv: v.string(),
    tokenTag: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return ctx.db.insert("googleConnections", {
      ...args,
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTokens = mutation({
  args: {
    connectionId: v.id("googleConnections"),
    encryptedTokens: v.string(),
    tokenIv: v.string(),
    tokenTag: v.string(),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new ConvexError(ERR_GOOGLE_CONNECTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, conn.workspaceId);
    await ctx.db.patch(args.connectionId, {
      encryptedTokens: args.encryptedTokens,
      tokenIv: args.tokenIv,
      tokenTag: args.tokenTag,
      lastSyncedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    connectionId: v.id("googleConnections"),
    status: googleConnectionStatusValidator,
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new ConvexError(ERR_GOOGLE_CONNECTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, conn.workspaceId);
    await ctx.db.patch(args.connectionId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateStatusForCron = mutation({
  args: {
    connectionId: v.id("googleConnections"),
    status: googleConnectionStatusValidator,
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new ConvexError(ERR_GOOGLE_CONNECTION_NOT_FOUND);
    await ctx.db.patch(args.connectionId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateProperties = mutation({
  args: {
    connectionId: v.id("googleConnections"),
    ga4PropertyId: v.optional(v.string()),
    gscSiteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { connectionId, ...fields } = args;
    const conn = await ctx.db.get(connectionId);
    if (!conn) throw new ConvexError(ERR_GOOGLE_CONNECTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, conn.workspaceId);
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(updates).length === 0) return;
    await ctx.db.patch(connectionId, { ...updates, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { connectionId: v.id("googleConnections") },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new ConvexError(ERR_GOOGLE_CONNECTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, conn.workspaceId);
    await ctx.db.delete(args.connectionId);
  },
});
