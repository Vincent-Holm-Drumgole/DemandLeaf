import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { strategyStatusValidator } from "./validators";
import { ERR_STRATEGY_NOT_FOUND, ERR_UNAUTHORIZED } from "./errors";

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("strategies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const getById = query({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new Error(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    return strategy;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    businessOutcomes: v.string(),
    targetAudience: v.optional(v.string()),
    seedKeywords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return ctx.db.insert("strategies", {
      workspaceId: args.workspaceId,
      name: args.name,
      businessOutcomes: args.businessOutcomes,
      targetAudience: args.targetAudience,
      seedKeywords: args.seedKeywords,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    strategyId: v.id("strategies"),
    name: v.optional(v.string()),
    businessOutcomes: v.optional(v.string()),
    targetAudience: v.optional(v.string()),
    seedKeywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new Error(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.businessOutcomes !== undefined) patch.businessOutcomes = args.businessOutcomes;
    if (args.targetAudience !== undefined) patch.targetAudience = args.targetAudience;
    if (args.seedKeywords !== undefined) patch.seedKeywords = args.seedKeywords;
    await ctx.db.patch(args.strategyId, patch);
  },
});

export const archive = mutation({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) throw new Error(ERR_STRATEGY_NOT_FOUND);
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    await ctx.db.patch(args.strategyId, {
      status: "archived" as const,
      updatedAt: Date.now(),
    });
  },
});

// Internal query used by API routes that need workspace validation separately
export const getByIdInternal = query({
  args: { strategyId: v.id("strategies"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy || strategy.workspaceId !== args.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
    }
    return strategy;
  },
});

// Suppress unused import warning — strategyStatusValidator used in schema
void strategyStatusValidator;
