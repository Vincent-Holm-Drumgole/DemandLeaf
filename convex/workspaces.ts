import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const VALID_ARCHETYPES = ["how_to", "listicle", "definitive_guide"] as const;
type Archetype = (typeof VALID_ARCHETYPES)[number];

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getByClerkUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query("workspaces")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .order("desc")
      .first();
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Provisions a workspace for a newly signed-up user and optionally migrates
 * an anonymous session (crawl data + voice profile + blog) into it.
 *
 * Called from POST /api/provision after Clerk sign-up completes.
 * Convex mutations are atomic by default — no explicit transaction needed.
 */
export const provision = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find or create workspace
    let workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!workspace) {
      const id = await ctx.db.insert("workspaces", {
        clerkUserId: args.clerkUserId,
        name: args.name,
        createdAt: now,
        updatedAt: now,
      });
      workspace = (await ctx.db.get(id))!;
    }

    const workspaceId = workspace._id;

    // Migrate anonymous session if provided
    if (args.sessionToken) {
      const session = await ctx.db
        .query("anonymousSessions")
        .withIndex("by_token", (q) => q.eq("sessionToken", args.sessionToken!))
        .unique();

      if (session && session.expiresAt > now) {
        const crawlData = asRecord(session.crawlData);
        const voiceProfileData = asRecord(session.voiceProfile);
        const blogData = asRecord(session.blogData);

        // Patch workspace with crawl context
        const workspaceUpdate: Record<string, unknown> = { updatedAt: now };
        if (typeof crawlData?.url === "string") workspaceUpdate.url = crawlData.url;
        if (typeof crawlData?.industry === "string") workspaceUpdate.industry = crawlData.industry;
        if (typeof crawlData?.audience === "string")
          workspaceUpdate.audienceDescription = crawlData.audience;
        await ctx.db.patch(workspaceId, workspaceUpdate);

        // Insert crawled pages
        const pages = Array.isArray(crawlData?.pages) ? crawlData.pages : [];
        await Promise.all(
          pages
            .map((p) => toCrawledPageRecord(p, workspaceId))
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .map((p) => ctx.db.insert("crawledPages", p))
        );

        // Insert voice profile
        if (voiceProfileData) {
          await ctx.db.insert("voiceProfiles", {
            workspaceId,
            voiceAttributes: {
              formality: toSafeNumber(voiceProfileData.formality) ?? 0,
              humor: toSafeNumber(voiceProfileData.humor) ?? 0,
              jargonLevel: toSafeNumber(voiceProfileData.jargonLevel) ?? 0,
              sentenceComplexity: toSafeNumber(voiceProfileData.sentenceComplexity) ?? 0,
              toneAttributes: toStringArray(voiceProfileData.toneAttributes),
            },
            voiceDescription:
              typeof voiceProfileData.voiceDescription === "string"
                ? voiceProfileData.voiceDescription
                : "Professional and clear",
            vocabularyPreferences: {
              preferred: toStringArray(voiceProfileData.preferredVocabulary),
              avoid: toStringArray(voiceProfileData.avoidedVocabulary),
            },
            writingExamples: toStringArray(voiceProfileData.writingExamples),
            sourceQuality:
              typeof voiceProfileData.sourceQuality === "string"
                ? voiceProfileData.sourceQuality
                : "limited",
            createdAt: now,
            updatedAt: now,
          });
        }

        // Insert blog if present
        if (blogData && typeof blogData.content === "string" && blogData.content.trim().length > 0) {
          await ctx.db.insert("blogs", {
            workspaceId,
            title:
              typeof blogData.title === "string" && blogData.title.trim().length > 0
                ? blogData.title.trim()
                : "Imported Draft",
            slug: typeof blogData.slug === "string" ? blogData.slug.trim() || undefined : undefined,
            content: blogData.content,
            contentHtml: typeof blogData.contentHtml === "string" ? blogData.contentHtml : undefined,
            metaTitle: typeof blogData.metaTitle === "string" ? blogData.metaTitle : undefined,
            metaDescription:
              typeof blogData.metaDescription === "string" ? blogData.metaDescription : undefined,
            focusKeyword:
              typeof blogData.focusKeyword === "string" ? blogData.focusKeyword : undefined,
            archetype: toArchetype(blogData.archetype),
            wordCount: toSafeNumber(blogData.wordCount) ?? undefined,
            status: "draft",
            seoScore: toSafeNumber(blogData.seoScore) ?? undefined,
            qualityScore: toSafeNumber(blogData.qualityScore) ?? undefined,
            detectionRisk:
              typeof blogData.detectionRisk === "string" ? blogData.detectionRisk : undefined,
            detectionRiskScore: toSafeNumber(blogData.detectionRiskScore) ?? undefined,
            burstinessScore:
              typeof blogData.burstinessScore === "number" ? blogData.burstinessScore : undefined,
            readabilityScore:
              typeof blogData.readabilityScore === "number" ? blogData.readabilityScore : undefined,
            modelUsed: typeof blogData.modelUsed === "string" ? blogData.modelUsed : "sonnet",
            inputTokens: toSafeNumber(blogData.inputTokens) ?? undefined,
            outputTokens: toSafeNumber(blogData.outputTokens) ?? undefined,
            generationCostCents: toSafeNumber(blogData.generationCostCents) ?? undefined,
            generationTimeMs: toSafeNumber(blogData.generationTimeMs) ?? undefined,
            promptVersion:
              typeof blogData.promptVersion === "string" ? blogData.promptVersion : undefined,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Delete the anonymous session
        await ctx.db.delete(session._id);
      }
    }

    return { workspaceId };
  },
});

// ─── Helpers (ported from lib/session-store.ts) ───────────────────────────────

function toCrawledPageRecord(
  value: unknown,
  workspaceId: Id<"workspaces">
): {
  workspaceId: Id<"workspaces">;
  url: string;
  pageType: string | undefined;
  title: string | undefined;
  content: string | undefined;
  wordCount: number | undefined;
  crawledAt: number;
} | null {
  const page = asRecord(value);
  if (!page || typeof page.url !== "string") return null;
  return {
    workspaceId,
    url: page.url,
    pageType: typeof page.type === "string" ? page.type : undefined,
    title: typeof page.title === "string" ? page.title : undefined,
    content: typeof page.content === "string" ? page.content : undefined,
    wordCount: toSafeNumber(page.wordCount) ?? undefined,
    crawledAt: Date.now(),
  };
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function toArchetype(value: unknown): Archetype {
  if (typeof value === "string" && VALID_ARCHETYPES.includes(value as Archetype)) {
    return value as Archetype;
  }
  return "how_to";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}
