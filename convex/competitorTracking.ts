import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireWorkspaceAccess, requireCronAccess } from "./helpers";
import { ERR_COMPETITOR_TRACKING_NOT_FOUND } from "./errors";
import type { Id } from "./_generated/dataModel";

const MAX_DOMAINS_PER_STRATEGY = 10;
const MAX_KEYWORDS_PER_DOMAIN = 5;
const MAX_TRACKING_PER_WORKSPACE = 50;

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

function normalizeTrackedKeywords(keywords: string[]): string[] {
  return keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS_PER_DOMAIN);
}

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    domain: v.string(),
    trackedKeywords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    // Enforce caps
    const existing = await ctx.db
      .query("competitorTracking")
      .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
      .take(MAX_DOMAINS_PER_STRATEGY + 1);

    if (existing.length >= MAX_DOMAINS_PER_STRATEGY) {
      throw new ConvexError(`Maximum ${MAX_DOMAINS_PER_STRATEGY} competitor domains per strategy`);
    }

    const keywords = normalizeTrackedKeywords(args.trackedKeywords);
    const now = Date.now();
    return ctx.db.insert("competitorTracking", {
      workspaceId: args.workspaceId,
      strategyId: args.strategyId,
      domain: normalizeDomain(args.domain),
      trackedKeywords: keywords,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const replaceByStrategy = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    competitors: v.array(v.object({
      domain: v.string(),
      trackedKeywords: v.array(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy || strategy.workspaceId !== args.workspaceId) {
      throw new ConvexError("Strategy not found for workspace");
    }

    if (args.competitors.length > MAX_DOMAINS_PER_STRATEGY) {
      throw new ConvexError(`Maximum ${MAX_DOMAINS_PER_STRATEGY} competitor domains per strategy`);
    }

    let removed = 0;
    while (true) {
      const batch = await ctx.db
        .query("competitorTracking")
        .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
        .take(MAX_TRACKING_PER_WORKSPACE);

      if (batch.length === 0) {
        break;
      }

      await Promise.all(batch.map((record) => ctx.db.delete(record._id)));
      removed += batch.length;
    }

    const now = Date.now();
    const ids: Array<Id<"competitorTracking">> = [];
    for (const competitor of args.competitors) {
      const id = await ctx.db.insert("competitorTracking", {
        workspaceId: args.workspaceId,
        strategyId: args.strategyId,
        domain: normalizeDomain(competitor.domain),
        trackedKeywords: normalizeTrackedKeywords(competitor.trackedKeywords),
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }

    return { removed, created: ids.length, ids };
  },
});

export const listByStrategy = query({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy) return [];
    await requireWorkspaceAccess(ctx, strategy.workspaceId);
    return ctx.db
      .query("competitorTracking")
      .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
      .take(MAX_TRACKING_PER_WORKSPACE);
  },
});

export const listByWorkspaceForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("competitorTracking")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(MAX_TRACKING_PER_WORKSPACE);
  },
});

export const updateLastChecked = mutation({
  args: {
    trackingId: v.id("competitorTracking"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const record = await ctx.db.get(args.trackingId);
    if (!record) throw new ConvexError(ERR_COMPETITOR_TRACKING_NOT_FOUND);
    await ctx.db.patch(args.trackingId, {
      lastCheckedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { trackingId: v.id("competitorTracking") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.trackingId);
    if (!record) throw new ConvexError(ERR_COMPETITOR_TRACKING_NOT_FOUND);
    await requireWorkspaceAccess(ctx, record.workspaceId);
    await ctx.db.delete(args.trackingId);
  },
});
