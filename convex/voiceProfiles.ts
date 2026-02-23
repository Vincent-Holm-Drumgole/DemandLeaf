import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

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
    const existing = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
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
        wizardCompleted: true,
        wizardCompletedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("voiceProfiles", {
      workspaceId: args.workspaceId,
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
      wizardCompleted: true,
      wizardCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    });
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
