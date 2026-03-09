import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { ERR_UNAUTHENTICATED } from "./errors";
import { seoDataCacheDataValidator } from "./validators";

const MAX_DUPLICATE_RECORDS_TO_SCAN = 50;

/** Returns cached data if it exists and has not expired, otherwise null. */
export const get = query({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null; // treat as cache miss for anonymous callers

    const newest = await ctx.db
      .query("seoDataCache")
      .withIndex("by_cache_key", (q) => q.eq("cacheKey", args.cacheKey))
      .order("desc")
      .first();
    if (!newest) return null;
    if (newest.expiresAt <= Date.now()) return null;
    return newest.data;
  },
});

/**
 * Batch cache lookup. Returns a map of cacheKey → data for all keys that exist
 * and have not expired. Missing/expired keys are absent from the result.
 * All index lookups run server-side in a single Convex query call.
 */
export const getMany = query({
  args: { cacheKeys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {} as Record<string, unknown>;

    const now = Date.now();
    const result: Record<string, unknown> = {};
    await Promise.all(
      args.cacheKeys.map(async (cacheKey) => {
        const newest = await ctx.db
          .query("seoDataCache")
          .withIndex("by_cache_key", (q) => q.eq("cacheKey", cacheKey))
          .order("desc")
          .first();
        if (!newest) return;
        if (newest.expiresAt > now) {
          result[cacheKey] = newest.data;
        }
      })
    );
    return result;
  },
});

/** Invalidate cache entries by exact keys. Sets expiresAt to 0 so they're treated as misses. */
export const invalidateKeys = mutation({
  args: { cacheKeys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(ERR_UNAUTHENTICATED);

    const BATCH = 50;
    for (let i = 0; i < args.cacheKeys.length; i += BATCH) {
      const batch = args.cacheKeys.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (cacheKey) => {
          const entry = await ctx.db
            .query("seoDataCache")
            .withIndex("by_cache_key", (q) => q.eq("cacheKey", cacheKey))
            .order("desc")
            .first();
          if (entry) {
            await ctx.db.patch(entry._id, { expiresAt: 0 });
          }
        })
      );
    }
  },
});

/** Upserts a cache entry. Overwrites any existing entry for the same cacheKey. */
export const set = mutation({
  args: {
    cacheKey: v.string(),
    data: seoDataCacheDataValidator,
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError(ERR_UNAUTHENTICATED);
    }

    const existing = await ctx.db
      .query("seoDataCache")
      .withIndex("by_cache_key", (q) => q.eq("cacheKey", args.cacheKey))
      .order("desc")
      .take(MAX_DUPLICATE_RECORDS_TO_SCAN);

    if (existing.length > 0) {
      const [primary, ...duplicates] = existing;
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
