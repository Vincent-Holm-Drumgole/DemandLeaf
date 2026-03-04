import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    return ctx.db
      .query("voiceProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
  },
});

export const getByWorkspaceForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("voiceProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
  },
});

/**
 * Patch a voice profile from wizard answers.
 * Creates the record if it doesn't exist yet.
 */
export const updateFromWizard = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    patch: v.object({
      voiceDescription: v.string(),
      formality: v.number(),
      humor: v.number(),
      jargonLevel: v.number(),
      sentenceComplexity: v.number(),
      toneAttributes: v.array(v.string()),
      preferredVocabulary: v.array(v.string()),
      avoidedVocabulary: v.array(v.string()),
      writingExamples: v.array(v.string()),
      sourceQuality: v.string(),
      thoughtLeadershipPositions: v.optional(v.array(v.string())),
      brandPhilosophy: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const now = Date.now();
    const profileData = {
      voiceAttributes: {
        formality: args.patch.formality,
        humor: args.patch.humor,
        jargonLevel: args.patch.jargonLevel,
        sentenceComplexity: args.patch.sentenceComplexity,
        toneAttributes: args.patch.toneAttributes,
      },
      voiceDescription: args.patch.voiceDescription,
      vocabularyPreferences: {
        preferred: args.patch.preferredVocabulary,
        avoid: args.patch.avoidedVocabulary,
      },
      writingExamples: args.patch.writingExamples,
      sourceQuality: args.patch.sourceQuality,
      thoughtLeadershipPositions: args.patch.thoughtLeadershipPositions,
      brandPhilosophy: args.patch.brandPhilosophy,
      wizardCompleted: true as const,
      wizardCompletedAt: now,
      updatedAt: now,
    };

    const existing = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, profileData);
      return existing._id;
    }

    return ctx.db.insert("voiceProfiles", {
      workspaceId: args.workspaceId,
      ...profileData,
      createdAt: now,
    });
  },
});
