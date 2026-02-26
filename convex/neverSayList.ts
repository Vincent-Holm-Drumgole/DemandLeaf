import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { termTypeValidator } from "./validators";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_ENTRY_NOT_FOUND, ERR_NEVER_SAY_LIMIT, ERR_NEVER_SAY_DUPLICATE } from "./errors";

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    return ctx.db
      .query("neverSayList")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(100);
  },
});

/** Returns only term strings (for prompt injection) */
export const getAllTerms = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entries = await ctx.db
      .query("neverSayList")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(100);
    return entries.map((e) => e.term);
  },
});

export const add = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    term: v.string(),
    termType: termTypeValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    // Check limit
    const existing = await ctx.db
      .query("neverSayList")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(101);
    if (existing.length >= 100) {
      throw new Error(`${ERR_NEVER_SAY_LIMIT} 100-term limit reached`);
    }
    // Check for duplicates (case-insensitive)
    const lower = args.term.toLowerCase();
    const duplicate = existing.find((e) => e.term.toLowerCase() === lower);
    if (duplicate) {
      throw new Error(`${ERR_NEVER_SAY_DUPLICATE} term already exists: ${args.term}`);
    }
    return ctx.db.insert("neverSayList", {
      workspaceId: args.workspaceId,
      term: args.term,
      termType: args.termType,
      addedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    entryId: v.id("neverSayList"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_ENTRY_NOT_FOUND);
    }
    await ctx.db.delete(args.entryId);
  },
});
