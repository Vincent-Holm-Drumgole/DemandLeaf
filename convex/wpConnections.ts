import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_WP_CONNECTION_NOT_FOUND } from "./errors";
import { wpAuthMethodValidator, wpConnectionStatusValidator, wpPluginValidator } from "./validators";

const MAX_WP_CONNECTIONS = 10;

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("wpConnections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(MAX_WP_CONNECTIONS);
  },
});

export const getById = query({
  args: { connectionId: v.id("wpConnections") },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) return null;
    await requireWorkspaceAccess(ctx, conn.workspaceId);
    return conn;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    siteUrl: v.string(),
    authMethod: wpAuthMethodValidator,
    encryptedCredentials: v.string(),
    credentialIv: v.string(),
    credentialTag: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return ctx.db.insert("wpConnections", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    connectionId: v.id("wpConnections"),
    status: wpConnectionStatusValidator,
    pluginDetected: v.optional(wpPluginValidator),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new ConvexError(ERR_WP_CONNECTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, conn.workspaceId);
    const now = Date.now();
    await ctx.db.patch(args.connectionId, {
      status: args.status,
      ...(args.pluginDetected !== undefined && {
        pluginDetected: args.pluginDetected,
      }),
      lastTestedAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { connectionId: v.id("wpConnections") },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new ConvexError(ERR_WP_CONNECTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, conn.workspaceId);
    await ctx.db.delete(args.connectionId);
  },
});
