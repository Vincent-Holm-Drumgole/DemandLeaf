import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// All functions here are unauthenticated — anonymous sessions exist before any user logs in.

export const create = mutation({
  args: {
    sessionToken: v.string(),
    crawlData: v.optional(v.any()),
    voiceProfile: v.optional(v.any()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("anonymousSessions", {
      sessionToken: args.sessionToken,
      crawlData: args.crawlData,
      voiceProfile: args.voiceProfile,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("anonymousSessions")
      .withIndex("by_token", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();
  },
});

export const updateBlogData = mutation({
  args: {
    sessionToken: v.string(),
    blogData: v.any(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("anonymousSessions")
      .withIndex("by_token", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();
    if (!session) return;
    await ctx.db.patch(session._id, { blogData: args.blogData });
  },
});

export const remove = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("anonymousSessions")
      .withIndex("by_token", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});
