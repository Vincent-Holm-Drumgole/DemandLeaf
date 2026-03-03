import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { schemaTypeValidator, wpStatusValidator } from "./validators";

const PAGE_SIZE = 20;
const MAX_DASHBOARD_SCAN = 5_000;
const MAX_CANNIBALIZATION_BLOGS = 300;
const MAX_BLOG_FEEDBACK = 500;

// ─── Queries ──────────────────────────────────────────────────────────────────

export const listByWorkspace = query({
  args: {
    cursor: v.optional(v.number()), // createdAt Unix ms of last item seen
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!workspace) {
      return { blogs: [], nextCursor: null, workspaceName: "My Workspace", total: 0 };
    }

    const size = args.pageSize ?? PAGE_SIZE;

    const allDocs = await ctx.db
      .query("blogs")
      .withIndex("by_workspace_created", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(MAX_DASHBOARD_SCAN);

    // Cursor filtering (createdAt < cursor)
    const filtered =
      args.cursor !== undefined
        ? allDocs.filter((b) => b.createdAt < args.cursor!)
        : allDocs;

    const total = allDocs.length;
    const hasMore = filtered.length > size;
    const page = hasMore ? filtered.slice(0, size) : filtered;
    const nextCursor = hasMore ? page[page.length - 1].createdAt : null;

    return {
      blogs: page,
      nextCursor,
      workspaceName: workspace.name,
      total,
    };
  },
});

export const listByWorkspaceId = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("blogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(MAX_CANNIBALIZATION_BLOGS);
  },
});

export const listPublishedForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("blogs")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "published")
      )
      .order("desc")
      .take(MAX_CANNIBALIZATION_BLOGS);
  },
});

export const getById = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const blog = await ctx.db.get(args.blogId);
    if (!blog) return null;

    // Verify ownership: blog's workspace must belong to calling user
    const workspace = await ctx.db.get(blog.workspaceId);
    if (!workspace || workspace.clerkUserId !== identity.subject) return null;

    const feedback = await ctx.db
      .query("blogFeedback")
      .withIndex("by_blog_created", (q) => q.eq("blogId", args.blogId))
      .order("desc")
      .take(MAX_BLOG_FEEDBACK);

    return { ...blog, feedback };
  },
});

export const getExportData = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const blog = await ctx.db.get(args.blogId);
    if (!blog) return null;

    const workspace = await ctx.db.get(blog.workspaceId);
    if (!workspace || workspace.clerkUserId !== identity.subject) return null;

    return {
      content: blog.content,
      contentHtml: blog.contentHtml ?? null,
      title: blog.title,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    slug: v.optional(v.string()),
    content: v.string(),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    focusKeyword: v.optional(v.string()),
    archetype: v.string(),
    wordCount: v.optional(v.number()),
    status: v.string(),
    seoScore: v.optional(v.number()),
    qualityScore: v.optional(v.number()),
    detectionRisk: v.optional(v.string()),
    detectionRiskScore: v.optional(v.number()),
    burstinessScore: v.optional(v.number()),
    readabilityScore: v.optional(v.number()),
    modelUsed: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    generationCostCents: v.optional(v.number()),
    generationTimeMs: v.optional(v.number()),
    promptVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.clerkUserId !== identity.subject) {
      throw new Error("Workspace not found or access denied");
    }

    const now = Date.now();
    return ctx.db.insert("blogs", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    blogId: v.id("blogs"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    focusKeyword: v.optional(v.string()),
    slug: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const { blogId, ...fields } = args;
    const blog = await ctx.db.get(blogId);
    if (!blog) throw new Error("Blog not found");

    const workspace = await ctx.db.get(blog.workspaceId);
    if (!workspace || workspace.clerkUserId !== identity.subject) {
      throw new Error("Access denied");
    }

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(updates).length === 0) return;
    await ctx.db.patch(blogId, { ...updates, updatedAt: Date.now() });
  },
});

// ─── Phase 5: Publishing data ─────────────────────────────────────────────────

export const updatePublishingData = mutation({
  args: {
    blogId: v.id("blogs"),
    aeoScore: v.optional(v.number()),
    schemaType: v.optional(schemaTypeValidator),
    schemaJson: v.optional(v.string()),
    wpPostId: v.optional(v.number()),
    wpPostUrl: v.optional(v.string()),
    wpStatus: v.optional(wpStatusValidator),
    wpScheduledAt: v.optional(v.number()),
    wpConnectionId: v.optional(v.id("wpConnections")),
    authorPersonaId: v.optional(v.id("authorPersonas")),
    publishedAt: v.optional(v.number()),
    internalLinksGenerated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const { blogId, ...fields } = args;
    const blog = await ctx.db.get(blogId);
    if (!blog) throw new Error("Blog not found");

    const workspace = await ctx.db.get(blog.workspaceId);
    if (!workspace || workspace.clerkUserId !== identity.subject) {
      throw new Error("Access denied");
    }

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(updates).length === 0) return;
    await ctx.db.patch(blogId, { ...updates, updatedAt: Date.now() });
  },
});
