import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  getWorkspaceAccess,
  requireCronAccess,
  requireWorkspaceAdminAccess,
} from "./helpers";
import { ERR_UNAUTHORIZED, ERR_WORKSPACE_NOT_FOUND } from "./errors";
import { planStatusValidator } from "./validators";

const VALID_ARCHETYPES = [
  "how_to",
  "listicle",
  "definitive_guide",
  "thought_leadership",
  "comparison",
  "data_study",
  "case_study",
  "news_commentary",
] as const;
type Archetype = (typeof VALID_ARCHETYPES)[number];
const MAX_WORKSPACES_PER_CRON_RUN = 500;
const MAX_VIEWER_WORKSPACES = 100;
const TRIAL_DAYS = 14;
type WorkspaceRole = "owner" | "admin" | "member";

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getByClerkUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const workspaces = await listViewerWorkspaces(ctx, identity.subject);
    return workspaces[0] ?? null;
  },
});

export const listForViewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return listViewerWorkspaces(ctx, identity.subject);
  },
});

export const getByIdForViewer = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    try {
      const { workspace, role } = await getWorkspaceAccess(ctx, args.workspaceId);
      return { ...workspace, role };
    } catch {
      return null;
    }
  },
});

export const getById = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    try {
      const { workspace } = await getWorkspaceAccess(ctx, args.workspaceId);
      return workspace;
    } catch {
      return null;
    }
  },
});

/**
 * Admin listing used by scheduled background jobs (Inngest).
 * Access is gated by INNGEST_CRON_KEY rather than end-user auth.
 */
export const listAllForCron = query({
  args: {
    cronKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const limit = Math.min(args.limit ?? MAX_WORKSPACES_PER_CRON_RUN, MAX_WORKSPACES_PER_CRON_RUN);
    return ctx.db.query("workspaces").order("desc").take(limit);
  },
});

export const getByIdForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db.get(args.workspaceId);
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
    name: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    const clerkUserId = identity.subject;

    const now = Date.now();
    const existingOwnedWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
    const trialEndsAt = existingOwnedWorkspace
      ? now
      : now + TRIAL_DAYS * 24 * 60 * 60 * 1000;

    const workspaceId = await ctx.db.insert("workspaces", {
      clerkUserId,
      name: args.name,
      plan: "trial",
      trialEndsAt,
      minPublishQualityScore: 70,
      createdAt: now,
      updatedAt: now,
    });

    await ensureWorkspaceMembership(ctx, workspaceId, clerkUserId, "owner", now);

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

    return {
      workspaceId,
      trialActive: trialEndsAt > now,
    };
  },
});

export const backfillViewerMemberships = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const now = Date.now();
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .take(MAX_VIEWER_WORKSPACES);

    let created = 0;
    for (const workspace of ownedWorkspaces) {
      const inserted = await ensureWorkspaceMembership(
        ctx,
        workspace._id,
        identity.subject,
        "owner",
        now,
      );
      if (inserted) {
        created += 1;
      }
    }

    return { created };
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

async function listViewerWorkspaces(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<Array<Doc<"workspaces"> & { role: WorkspaceRole }>> {
  const [memberships, ownedWorkspaces] = await Promise.all([
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .take(MAX_VIEWER_WORKSPACES),
    ctx.db
      .query("workspaces")
      .withIndex("by_clerk_user_created", (q) => q.eq("clerkUserId", clerkUserId))
      .order("desc")
      .take(MAX_VIEWER_WORKSPACES),
  ]);

  const byId = new Map<string, Doc<"workspaces"> & { role: WorkspaceRole }>();

  const membershipWorkspaces = await Promise.all(
    memberships.map(async (membership) => {
      const workspace = await ctx.db.get(membership.workspaceId);
      return workspace ? { ...workspace, role: membership.role } : null;
    }),
  );

  for (const workspace of membershipWorkspaces) {
    if (workspace) {
      byId.set(workspace._id, workspace);
    }
  }

  for (const workspace of ownedWorkspaces) {
    byId.set(workspace._id, { ...workspace, role: "owner" });
  }

  return Array.from(byId.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt,
  );
}

async function ensureWorkspaceMembership(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  clerkUserId: string,
  role: WorkspaceRole,
  now: number,
): Promise<boolean> {
  const existing = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("clerkUserId", clerkUserId),
    )
    .unique();

  if (existing) {
    if (existing.role !== role) {
      await ctx.db.patch(existing._id, { role, updatedAt: now });
    }
    return false;
  }

  await ctx.db.insert("workspaceMembers", {
    workspaceId,
    clerkUserId,
    role,
    createdAt: now,
    updatedAt: now,
  });
  return true;
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

// ── Profile ──────────────────────────────────────────────────────────────────

export const updateProfile = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    url: v.optional(v.string()),
    industry: v.optional(v.string()),
    audienceDescription: v.optional(v.string()),
    masterContext: v.optional(v.string()),
    minPublishQualityScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAdminAccess(ctx, args.workspaceId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.url !== undefined) patch.url = args.url;
    if (args.industry !== undefined) patch.industry = args.industry;
    if (args.audienceDescription !== undefined) patch.audienceDescription = args.audienceDescription;
    if (args.masterContext !== undefined) patch.masterContext = args.masterContext;
    if (args.minPublishQualityScore !== undefined) {
      patch.minPublishQualityScore = args.minPublishQualityScore;
    }
    await ctx.db.patch(args.workspaceId, patch);
  },
});

// ── Billing ──────────────────────────────────────────────────────────────────

export const updateBilling = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.optional(planStatusValidator),
    planExpiresAt: v.optional(v.number()),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new ConvexError(ERR_WORKSPACE_NOT_FOUND);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.stripeCustomerId !== undefined) patch.stripeCustomerId = args.stripeCustomerId;
    if (args.stripeSubscriptionId !== undefined) patch.stripeSubscriptionId = args.stripeSubscriptionId;
    if (args.plan !== undefined) patch.plan = args.plan;
    if (args.planExpiresAt !== undefined) patch.planExpiresAt = args.planExpiresAt;

    await ctx.db.patch(args.workspaceId, patch);
  },
});

export const deleteWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const { workspace, role } = await getWorkspaceAccess(ctx, args.workspaceId);
    if (role !== "owner") {
      throw new ConvexError(ERR_UNAUTHORIZED);
    }

    const workspaceId = workspace._id;

    const blogs = await ctx.db
      .query("blogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const blogIds = blogs.map((blog) => blog._id);

    for (const blogId of blogIds) {
      const blogFeedback = await ctx.db
        .query("blogFeedback")
        .withIndex("by_blog", (q) => q.eq("blogId", blogId))
        .collect();
      for (const entry of blogFeedback) {
        await ctx.db.delete(entry._id);
      }
    }

    const workspaceMembers = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const voiceProfiles = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const crawledPages = await ctx.db
      .query("crawledPages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const knowledgeBaseEntries = await ctx.db
      .query("knowledgeBase")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const knowledgeBaseChunks = await ctx.db
      .query("knowledgeBaseChunks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const neverSayEntries = await ctx.db
      .query("neverSayList")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const calibrationHistory = await ctx.db
      .query("calibrationHistory")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const blogEdits = await ctx.db
      .query("blogEdits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const strategies = await ctx.db
      .query("strategies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const topicClusters = await ctx.db
      .query("topicClusters")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const contentBriefs = await ctx.db
      .query("contentBriefs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const contentCalendar = await ctx.db
      .query("contentCalendar")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const wpConnections = await ctx.db
      .query("wpConnections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const authorPersonas = await ctx.db
      .query("authorPersonas")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const internalLinks = await ctx.db
      .query("internalLinks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const rankSnapshots = await ctx.db
      .query("rankSnapshots")
      .withIndex("by_workspace_checked", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const performanceMetrics = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_workspace_period", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const decayAlerts = await ctx.db
      .query("decayAlerts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const refreshHistory = await ctx.db
      .query("refreshHistory")
      .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const googleConnections = await ctx.db
      .query("googleConnections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const agentActions = await ctx.db
      .query("agentActions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const scoredOutputs = await ctx.db
      .query("scoredOutputs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const workspaceScoreStats = await ctx.db
      .query("workspaceScoreStats")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const coachingNotesLibrary = await ctx.db
      .query("coachingNotesLibrary")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const tagFrequency = await ctx.db
      .query("tagFrequency")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const generationContextLog = await ctx.db
      .query("generationContextLog")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const agentAuditLog = await ctx.db
      .query("agentAuditLog")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const competitorTracking = await ctx.db
      .query("competitorTracking")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const publishingAgentConfig = await ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const collections = [
      notifications,
      generationContextLog,
      tagFrequency,
      coachingNotesLibrary,
      workspaceScoreStats,
      scoredOutputs,
      agentAuditLog,
      agentActions,
      decayAlerts,
      refreshHistory,
      performanceMetrics,
      rankSnapshots,
      internalLinks,
      contentCalendar,
      contentBriefs,
      keywords,
      topicClusters,
      competitorTracking,
      strategies,
      blogEdits,
      calibrationHistory,
      knowledgeBaseEntries,
      knowledgeBaseChunks,
      neverSayEntries,
      crawledPages,
      googleConnections,
      wpConnections,
      authorPersonas,
      publishingAgentConfig,
      voiceProfiles,
      blogs,
      workspaceMembers,
    ] as const;

    for (const docs of collections) {
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }

    await ctx.db.delete(workspaceId);

    const remainingWorkspaces = await listViewerWorkspaces(ctx, identity.subject);

    return {
      deletedWorkspaceId: workspaceId,
      remainingWorkspaceId: remainingWorkspaces[0]?._id ?? null,
    };
  },
});

export const getByStripeCustomer = query({
  args: {
    stripeCustomerId: v.string(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("workspaces")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
  },
});

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
