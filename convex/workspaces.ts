import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getWorkspaceAccess, requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { ERR_WORKSPACE_NOT_FOUND } from "./errors";
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
  ctx: QueryCtx,
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
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.url !== undefined) patch.url = args.url;
    if (args.industry !== undefined) patch.industry = args.industry;
    if (args.audienceDescription !== undefined) patch.audienceDescription = args.audienceDescription;
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
