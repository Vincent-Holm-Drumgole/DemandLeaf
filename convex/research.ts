import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  contentTrackValidator,
  researchBriefKindValidator,
  researchBriefStatusValidator,
  researchSourceStatusValidator,
  researchSourceTypeValidator,
} from "./validators";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";

export const listDashboard = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const [sources, briefs, competitorArticles] = await Promise.all([
      ctx.db.query("researchSources").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect(),
      ctx.db.query("researchBriefs").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect(),
      ctx.db.query("competitorArticles").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect(),
    ]);
    return { sources, briefs, competitorArticles };
  },
});

export const listSourcesForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("researchSources")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const listBriefsForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("researchBriefs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const createSource = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    label: v.string(),
    type: researchSourceTypeValidator,
    url: v.string(),
    keywords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return ctx.db.insert("researchSources", {
      workspaceId: args.workspaceId,
      label: args.label,
      type: args.type,
      url: args.url,
      keywords: args.keywords,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSource = mutation({
  args: {
    sourceId: v.id("researchSources"),
    label: v.optional(v.string()),
    type: v.optional(researchSourceTypeValidator),
    url: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    status: v.optional(researchSourceStatusValidator),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error("Research source not found");
    await requireWorkspaceAccess(ctx, source.workspaceId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.label !== undefined) patch.label = args.label;
    if (args.type !== undefined) patch.type = args.type;
    if (args.url !== undefined) patch.url = args.url;
    if (args.keywords !== undefined) patch.keywords = args.keywords;
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(args.sourceId, patch);
  },
});

export const removeSource = mutation({
  args: { sourceId: v.id("researchSources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error("Research source not found");
    await requireWorkspaceAccess(ctx, source.workspaceId);
    await ctx.db.delete(args.sourceId);
  },
});

export const createBrief = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.optional(v.id("researchSources")),
    kind: researchBriefKindValidator,
    status: researchBriefStatusValidator,
    title: v.string(),
    summary: v.string(),
    whyItMatters: v.string(),
    suggestedAngle: v.string(),
    sourceUrls: v.array(v.string()),
    sourceNames: v.array(v.string()),
    keywords: v.array(v.string()),
    relevanceScore: v.number(),
    contentTrack: contentTrackValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return ctx.db.insert("researchBriefs", {
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      kind: args.kind,
      status: args.status,
      title: args.title,
      summary: args.summary,
      whyItMatters: args.whyItMatters,
      suggestedAngle: args.suggestedAngle,
      sourceUrls: args.sourceUrls,
      sourceNames: args.sourceNames,
      keywords: args.keywords,
      relevanceScore: args.relevanceScore,
      contentTrack: args.contentTrack,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBrief = mutation({
  args: {
    briefId: v.id("researchBriefs"),
    status: v.optional(researchBriefStatusValidator),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    whyItMatters: v.optional(v.string()),
    suggestedAngle: v.optional(v.string()),
    sourceUrls: v.optional(v.array(v.string())),
    sourceNames: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    relevanceScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new Error("Research brief not found");
    await requireWorkspaceAccess(ctx, brief.workspaceId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.status !== undefined) patch.status = args.status;
    if (args.title !== undefined) patch.title = args.title;
    if (args.summary !== undefined) patch.summary = args.summary;
    if (args.whyItMatters !== undefined) patch.whyItMatters = args.whyItMatters;
    if (args.suggestedAngle !== undefined) patch.suggestedAngle = args.suggestedAngle;
    if (args.sourceUrls !== undefined) patch.sourceUrls = args.sourceUrls;
    if (args.sourceNames !== undefined) patch.sourceNames = args.sourceNames;
    if (args.keywords !== undefined) patch.keywords = args.keywords;
    if (args.relevanceScore !== undefined) patch.relevanceScore = args.relevanceScore;
    await ctx.db.patch(args.briefId, patch);
  },
});

export const createCompetitorArticle = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    trackingId: v.optional(v.id("competitorTracking")),
    domain: v.string(),
    url: v.string(),
    title: v.string(),
    summary: v.string(),
    angle: v.string(),
    keywords: v.array(v.string()),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return ctx.db.insert("competitorArticles", {
      workspaceId: args.workspaceId,
      trackingId: args.trackingId,
      domain: args.domain,
      url: args.url,
      title: args.title,
      summary: args.summary,
      angle: args.angle,
      keywords: args.keywords,
      publishedAt: args.publishedAt,
      scrapedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createBriefForCron = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.optional(v.id("researchSources")),
    title: v.string(),
    summary: v.string(),
    whyItMatters: v.string(),
    suggestedAngle: v.string(),
    sourceUrls: v.array(v.string()),
    sourceNames: v.array(v.string()),
    keywords: v.array(v.string()),
    relevanceScore: v.number(),
    kind: researchBriefKindValidator,
    notificationType: v.union(v.literal("research_brief_ready"), v.literal("trend_report_ready")),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const existing = await ctx.db
      .query("researchBriefs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const duplicate = existing.find((brief) => brief.title === args.title);
    const now = Date.now();
    const briefId = duplicate
      ? duplicate._id
      : await ctx.db.insert("researchBriefs", {
          workspaceId: args.workspaceId,
          sourceId: args.sourceId,
          kind: args.kind,
          status: "pending_review",
          title: args.title,
          summary: args.summary,
          whyItMatters: args.whyItMatters,
          suggestedAngle: args.suggestedAngle,
          sourceUrls: args.sourceUrls,
          sourceNames: args.sourceNames,
          keywords: args.keywords,
          relevanceScore: args.relevanceScore,
          contentTrack: "research",
          createdAt: now,
          updatedAt: now,
        });

    if (!duplicate) {
      await ctx.db.insert("notifications", {
        workspaceId: args.workspaceId,
        type: args.notificationType,
        title: args.kind === "trend_report" ? "Trend report ready" : "Research brief ready",
        body: args.title,
        read: false,
        createdAt: now,
      });
    }

    return briefId;
  },
});

export const recordCompetitorArticleForCron = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    trackingId: v.optional(v.id("competitorTracking")),
    domain: v.string(),
    url: v.string(),
    title: v.string(),
    summary: v.string(),
    angle: v.string(),
    keywords: v.array(v.string()),
    publishedAt: v.optional(v.number()),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const existing = await ctx.db
      .query("competitorArticles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const match = existing.find((article) => article.url === args.url);
    const now = Date.now();
    if (match) {
      await ctx.db.patch(match._id, {
        title: args.title,
        summary: args.summary,
        angle: args.angle,
        keywords: args.keywords,
        publishedAt: args.publishedAt,
        scrapedAt: now,
        updatedAt: now,
      });
      return match._id;
    }
    return ctx.db.insert("competitorArticles", {
      workspaceId: args.workspaceId,
      trackingId: args.trackingId,
      domain: args.domain,
      url: args.url,
      title: args.title,
      summary: args.summary,
      angle: args.angle,
      keywords: args.keywords,
      publishedAt: args.publishedAt,
      scrapedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSourceCheckForCron = mutation({
  args: {
    sourceId: v.id("researchSources"),
    status: researchSourceStatusValidator,
    errorMessage: v.optional(v.string()),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    await ctx.db.patch(args.sourceId, {
      status: args.status,
      errorMessage: args.errorMessage,
      lastCheckedAt: Date.now(),
      lastSuccessAt: args.status === "error" ? undefined : Date.now(),
      updatedAt: Date.now(),
    });
  },
});
