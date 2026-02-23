import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_WRITING_EXAMPLES = 5;
const HIGH_RATING_THRESHOLD = 8;

export const recordRating = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    voiceProfileId: v.id("voiceProfiles"),
    sampleParagraph: v.string(),
    rating: v.number(),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const addedToExamples = args.rating >= HIGH_RATING_THRESHOLD;

    // If high-rated, add to writingExamples on the voice profile (capped at MAX)
    if (addedToExamples) {
      const profile = await ctx.db.get(args.voiceProfileId);
      if (profile) {
        const currentExamples = profile.writingExamples ?? [];
        if (currentExamples.length < MAX_WRITING_EXAMPLES) {
          await ctx.db.patch(args.voiceProfileId, {
            writingExamples: [...currentExamples, args.sampleParagraph],
            updatedAt: Date.now(),
          });
        }
      }
    }

    // Increment calibration count
    const profile = await ctx.db.get(args.voiceProfileId);
    if (profile) {
      await ctx.db.patch(args.voiceProfileId, {
        calibrationCount: (profile.calibrationCount ?? 0) + 1,
        updatedAt: Date.now(),
      });
    }

    // Record in history
    return ctx.db.insert("calibrationHistory", {
      workspaceId: args.workspaceId,
      voiceProfileId: args.voiceProfileId,
      sampleParagraph: args.sampleParagraph,
      rating: args.rating,
      feedback: args.feedback,
      addedToExamples,
      createdAt: Date.now(),
    });
  },
});

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("calibrationHistory")
      .withIndex("by_workspace_created", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .order("desc")
      .take(args.limit ?? 50);
    return results;
  },
});
