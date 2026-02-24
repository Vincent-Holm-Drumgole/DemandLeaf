import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ERR_UNAUTHENTICATED } from "./errors";

/** Returns cached data if it exists and has not expired, otherwise null. */
export const get = query({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error(ERR_UNAUTHENTICATED);
    }

    const entries = await ctx.db
      .query("seoDataCache")
      .withIndex("by_cache_key", (q) => q.eq("cacheKey", args.cacheKey))
      .collect();
    if (entries.length === 0) return null;

    const newest = [...entries].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (newest.expiresAt <= Date.now()) return null;
    return newest.data;
  },
});

/** Upserts a cache entry. Overwrites any existing entry for the same cacheKey. */
export const set = mutation({
  args: {
    cacheKey: v.string(),
    data: v.any(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error(ERR_UNAUTHENTICATED);
    }

    const existing = await ctx.db
      .query("seoDataCache")
      .withIndex("by_cache_key", (q) => q.eq("cacheKey", args.cacheKey))
      .collect();

    if (existing.length > 0) {
      const [primary, ...duplicates] = [...existing].sort((a, b) => b.createdAt - a.createdAt);
      await ctx.db.patch(primary._id, {
        data: args.data,
        expiresAt: args.expiresAt,
      });
      await Promise.all(duplicates.map((dupe) => ctx.db.delete(dupe._id)));
    } else {
      await ctx.db.insert("seoDataCache", {
        cacheKey: args.cacheKey,
        data: args.data,
        expiresAt: args.expiresAt,
        createdAt: Date.now(),
      });
    }
  },
});
