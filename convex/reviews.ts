import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getWorkspaceAccess, requireWorkspaceAccess } from "./helpers";
import {
  ERR_BLOG_NOT_FOUND,
  ERR_REVIEW_REQUEST_NOT_FOUND,
  ERR_REVIEW_COMMENT_NOT_FOUND,
} from "./errors";
import { reviewStatusValidator, reviewActivityActionValidator, suggestionStatusValidator } from "./validators";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireBlogAccess(
  ctx: QueryCtx | MutationCtx,
  blogId: Id<"blogs">,
) {
  const blog = await ctx.db.get(blogId);
  if (!blog) throw new ConvexError(ERR_BLOG_NOT_FOUND);
  await requireWorkspaceAccess(ctx, blog.workspaceId);
  return blog;
}

async function getViewerClerkUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");
  return identity.subject;
}

async function createNotification(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  type: "review_requested" | "review_approved" | "review_changes_requested" | "review_comment_added",
  title: string,
  body: string,
) {
  await ctx.db.insert("notifications", {
    workspaceId,
    type,
    read: false,
    title,
    body,
    createdAt: Date.now(),
  });
}

async function logActivity(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  blogId: Id<"blogs">,
  actorClerkUserId: string,
  action: "comment_added" | "suggestion_added" | "suggestion_accepted" | "suggestion_rejected" | "review_requested" | "approved" | "changes_requested" | "comment_resolved" | "status_changed",
  detail?: string,
  relatedCommentId?: Id<"reviewComments">,
  relatedReviewRequestId?: Id<"reviewRequests">,
) {
  await ctx.db.insert("reviewActivity", {
    workspaceId,
    blogId,
    actorClerkUserId,
    action,
    detail,
    relatedCommentId,
    relatedReviewRequestId,
    createdAt: Date.now(),
  });
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const listReviewRequests = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    const blog = await requireBlogAccess(ctx, args.blogId);
    return ctx.db
      .query("reviewRequests")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .take(50);
  },
});

export const listCommentsByBlog = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    await requireBlogAccess(ctx, args.blogId);
    return ctx.db
      .query("reviewComments")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .take(500);
  },
});

export const listActivityByBlog = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    await requireBlogAccess(ctx, args.blogId);
    return ctx.db
      .query("reviewActivity")
      .withIndex("by_blog_created", (q) => q.eq("blogId", args.blogId))
      .order("desc")
      .take(200);
  },
});

export const getReviewStatus = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    await requireBlogAccess(ctx, args.blogId);
    const requests = await ctx.db
      .query("reviewRequests")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .take(50);

    const total = requests.length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const pending = requests.filter((r) => r.status === "pending").length;
    const changesRequested = requests.filter((r) => r.status === "changes_requested").length;

    return { total, approved, pending, changesRequested, allApproved: total > 0 && approved === total };
  },
});

export const listPendingForUser = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const clerkUserId = await getViewerClerkUserId(ctx);

    const pending = await ctx.db
      .query("reviewRequests")
      .withIndex("by_reviewer_status", (q) =>
        q.eq("reviewerClerkUserId", clerkUserId).eq("status", "pending")
      )
      .take(50);

    const blogIds = [...new Set(pending.map((r) => r.blogId))];
    const blogs = await Promise.all(
      blogIds.map(async (id) => {
        const blog = await ctx.db.get(id);
        if (!blog || blog.workspaceId !== args.workspaceId) return null;
        return { _id: blog._id, title: blog.title, status: blog.status, createdAt: blog.createdAt };
      })
    );

    return blogs.filter(Boolean);
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

export const requestReview = mutation({
  args: {
    blogId: v.id("blogs"),
    reviewerClerkUserIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const blog = await requireBlogAccess(ctx, args.blogId);
    const requesterClerkUserId = await getViewerClerkUserId(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("reviewRequests")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .take(50);
    const existingReviewers = new Set(existing.map((r) => r.reviewerClerkUserId));

    const created: Id<"reviewRequests">[] = [];
    for (const reviewerId of args.reviewerClerkUserIds) {
      if (existingReviewers.has(reviewerId)) continue;
      if (reviewerId === requesterClerkUserId) continue;

      const id = await ctx.db.insert("reviewRequests", {
        workspaceId: blog.workspaceId,
        blogId: args.blogId,
        reviewerClerkUserId: reviewerId,
        requestedByClerkUserId: requesterClerkUserId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      created.push(id);

      await createNotification(
        ctx,
        blog.workspaceId,
        "review_requested",
        "Review requested",
        `You've been asked to review "${blog.title}"`,
      );
    }

    // Set blog to in_review if not already
    if (blog.status === "draft" && created.length > 0) {
      await ctx.db.patch(args.blogId, { status: "in_review" });
    }

    await logActivity(
      ctx, blog.workspaceId, args.blogId, requesterClerkUserId,
      "review_requested",
      `Requested review from ${created.length} reviewer(s)`,
    );

    return { created: created.length };
  },
});

export const submitDecision = mutation({
  args: {
    reviewRequestId: v.id("reviewRequests"),
    status: v.union(v.literal("approved"), v.literal("changes_requested")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.reviewRequestId);
    if (!request) throw new ConvexError(ERR_REVIEW_REQUEST_NOT_FOUND);

    const blog = await requireBlogAccess(ctx, request.blogId);
    const clerkUserId = await getViewerClerkUserId(ctx);
    const now = Date.now();

    await ctx.db.patch(args.reviewRequestId, {
      status: args.status,
      note: args.note,
      decidedAt: now,
      updatedAt: now,
    });

    const notifType = args.status === "approved" ? "review_approved" as const : "review_changes_requested" as const;
    await createNotification(
      ctx, blog.workspaceId, notifType,
      args.status === "approved" ? "Review approved" : "Changes requested",
      `A reviewer ${args.status === "approved" ? "approved" : "requested changes on"} "${blog.title}"`,
    );

    await logActivity(
      ctx, blog.workspaceId, request.blogId, clerkUserId,
      args.status === "approved" ? "approved" : "changes_requested",
      args.note,
      undefined,
      args.reviewRequestId,
    );

    // Check if all reviewers approved
    if (args.status === "approved") {
      const allRequests = await ctx.db
        .query("reviewRequests")
        .withIndex("by_blog", (q) => q.eq("blogId", request.blogId))
        .take(50);

      const allApproved = allRequests.every((r) =>
        r._id === args.reviewRequestId ? true : r.status === "approved"
      );

      if (allApproved && allRequests.length > 0) {
        await ctx.db.patch(request.blogId, { status: "approved" });
        await logActivity(
          ctx, blog.workspaceId, request.blogId, clerkUserId,
          "status_changed",
          "All reviewers approved — blog status set to approved",
        );
      }
    }
  },
});

export const addComment = mutation({
  args: {
    blogId: v.id("blogs"),
    anchorParagraphIndex: v.number(),
    anchorText: v.optional(v.string()),
    body: v.string(),
    parentId: v.optional(v.id("reviewComments")),
  },
  handler: async (ctx, args) => {
    const blog = await requireBlogAccess(ctx, args.blogId);
    const clerkUserId = await getViewerClerkUserId(ctx);
    const now = Date.now();

    const commentId = await ctx.db.insert("reviewComments", {
      workspaceId: blog.workspaceId,
      blogId: args.blogId,
      parentId: args.parentId,
      authorClerkUserId: clerkUserId,
      anchorParagraphIndex: args.anchorParagraphIndex,
      anchorText: args.anchorText,
      body: args.body,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });

    await createNotification(
      ctx, blog.workspaceId, "review_comment_added",
      "New comment",
      `A comment was added on "${blog.title}"`,
    );

    await logActivity(
      ctx, blog.workspaceId, args.blogId, clerkUserId,
      "comment_added",
      args.body.slice(0, 100),
      commentId,
    );

    return commentId;
  },
});

export const addSuggestion = mutation({
  args: {
    blogId: v.id("blogs"),
    anchorParagraphIndex: v.number(),
    anchorText: v.optional(v.string()),
    body: v.string(),
    suggestionOriginal: v.string(),
    suggestionReplacement: v.string(),
  },
  handler: async (ctx, args) => {
    const blog = await requireBlogAccess(ctx, args.blogId);
    const clerkUserId = await getViewerClerkUserId(ctx);
    const now = Date.now();

    const commentId = await ctx.db.insert("reviewComments", {
      workspaceId: blog.workspaceId,
      blogId: args.blogId,
      authorClerkUserId: clerkUserId,
      anchorParagraphIndex: args.anchorParagraphIndex,
      anchorText: args.anchorText,
      body: args.body,
      resolved: false,
      suggestionOriginal: args.suggestionOriginal,
      suggestionReplacement: args.suggestionReplacement,
      suggestionStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await createNotification(
      ctx, blog.workspaceId, "review_comment_added",
      "New suggestion",
      `A text suggestion was added on "${blog.title}"`,
    );

    await logActivity(
      ctx, blog.workspaceId, args.blogId, clerkUserId,
      "suggestion_added",
      args.body.slice(0, 100),
      commentId,
    );

    return commentId;
  },
});

export const resolveSuggestion = mutation({
  args: {
    commentId: v.id("reviewComments"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new ConvexError(ERR_REVIEW_COMMENT_NOT_FOUND);

    await requireBlogAccess(ctx, comment.blogId);
    const clerkUserId = await getViewerClerkUserId(ctx);
    const now = Date.now();

    await ctx.db.patch(args.commentId, {
      suggestionStatus: args.accept ? "accepted" : "rejected",
      resolved: true,
      resolvedByClerkUserId: clerkUserId,
      resolvedAt: now,
      updatedAt: now,
    });

    await logActivity(
      ctx, comment.workspaceId, comment.blogId, clerkUserId,
      args.accept ? "suggestion_accepted" : "suggestion_rejected",
      undefined,
      args.commentId,
    );
  },
});

export const resolveComment = mutation({
  args: { commentId: v.id("reviewComments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new ConvexError(ERR_REVIEW_COMMENT_NOT_FOUND);

    await requireBlogAccess(ctx, comment.blogId);
    const clerkUserId = await getViewerClerkUserId(ctx);
    const now = Date.now();

    await ctx.db.patch(args.commentId, {
      resolved: true,
      resolvedByClerkUserId: clerkUserId,
      resolvedAt: now,
      updatedAt: now,
    });

    await logActivity(
      ctx, comment.workspaceId, comment.blogId, clerkUserId,
      "comment_resolved",
      undefined,
      args.commentId,
    );
  },
});

export const listWorkspaceMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(50);
  },
});
