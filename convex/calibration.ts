import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

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
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const addedToExamples = args.rating >= HIGH_RATING_THRESHOLD;
    const profile = await ctx.db.get(args.voiceProfileId);
    if (!profile || profile.workspaceId !== args.workspaceId) {
      throw new Error("Voice profile not found");
    }

    const currentExamples = profile.writingExamples ?? [];
    const profilePatch: {
      writingExamples?: string[];
      calibrationCount: number;
      updatedAt: number;
    } = {
      calibrationCount: (profile.calibrationCount ?? 0) + 1,
      updatedAt: Date.now(),
    };

    // If high-rated, append and enforce a hard max of MAX_WRITING_EXAMPLES.
    if (addedToExamples && currentExamples.length < MAX_WRITING_EXAMPLES) {
      profilePatch.writingExamples = [...currentExamples, args.sampleParagraph].slice(
        0,
        MAX_WRITING_EXAMPLES,
      );
    }

    await ctx.db.patch(args.voiceProfileId, profilePatch);

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
    await requireWorkspaceAccess(ctx, args.workspaceId);

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

async function requireWorkspaceAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"workspaces">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }

  const workspace = await ctx.db.get(workspaceId);
  if (!workspace || workspace.clerkUserId !== identity.subject) {
    throw new Error("Unauthorized");
  }

  return workspace;
}
