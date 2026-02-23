import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    blogId: v.id("blogs"),
    paragraphIndex: v.number(),
    feedback: v.union(v.literal("positive"), v.literal("negative")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    if (!Number.isInteger(args.paragraphIndex) || args.paragraphIndex < 0) {
      throw new Error("Invalid paragraph index");
    }

    const blog = await ctx.db.get(args.blogId);
    if (!blog) {
      throw new Error("Blog not found");
    }

    const workspace = await ctx.db.get(blog.workspaceId);
    if (!workspace || workspace.clerkUserId !== identity.subject) {
      throw new Error("Unauthorized");
    }

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
