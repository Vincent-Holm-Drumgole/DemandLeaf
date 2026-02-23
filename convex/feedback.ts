import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Unauthenticated — feedback doesn't require a logged-in user.
export const create = mutation({
  args: {
    blogId: v.id("blogs"),
    paragraphIndex: v.number(),
    feedback: v.string(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    const id = await ctx.db.insert("blogFeedback", {
      blogId: args.blogId,
      paragraphIndex: args.paragraphIndex,
      feedback: args.feedback,
      comment: args.comment,
      createdAt,
    });
    return { id, createdAt };
  },
});
