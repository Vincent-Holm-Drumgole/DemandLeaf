import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import {
  embeddingStatusValidator,
  kbEntryTypeValidator,
} from "./validators";

// ── Queries ────────────────────────────────────────────────────────────────────

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    entryType: v.optional(kbEntryTypeValidator),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entryType = args.entryType;
    if (entryType !== undefined) {
      return ctx.db
        .query("knowledgeBase")
        .withIndex("by_workspace_type", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("entryType", entryType)
        )
        .order("desc")
        .collect();
    }
    return ctx.db
      .query("knowledgeBase")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: {
    entryId: v.id("knowledgeBase"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.workspaceId !== args.workspaceId) return null;
    return entry;
  },
});

export const listReadyByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    return ctx.db
      .query("knowledgeBase")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("embeddingStatus", "ready")
      )
      .collect();
  },
});

export const getByIdInternal = internalQuery({
  args: { entryId: v.id("knowledgeBase") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.entryId);
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    entryType: kbEntryTypeValidator,
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const now = Date.now();
    const entryId = await ctx.db.insert("knowledgeBase", {
      workspaceId: args.workspaceId,
      entryType: args.entryType,
      title: args.title,
      content: args.content,
      tags: args.tags,
      embeddingStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    // Schedule async embedding generation
    await ctx.scheduler.runAfter(0, internal.knowledgeBase.generateAndStoreEmbedding, {
      entryId,
    });
    return entryId;
  },
});

export const update = mutation({
  args: {
    entryId: v.id("knowledgeBase"),
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.workspaceId !== args.workspaceId) {
      throw new Error("Entry not found");
    }
    const contentChanged = args.content !== undefined && args.content !== entry.content;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.content !== undefined) patch.content = args.content;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (contentChanged) patch.embeddingStatus = "pending";
    await ctx.db.patch(args.entryId, patch);
    if (contentChanged) {
      await ctx.scheduler.runAfter(0, internal.knowledgeBase.generateAndStoreEmbedding, {
        entryId: args.entryId,
      });
    }
  },
});

export const remove = mutation({
  args: {
    entryId: v.id("knowledgeBase"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.workspaceId !== args.workspaceId) {
      throw new Error("Entry not found");
    }
    await ctx.db.delete(args.entryId);
  },
});

export const storeEmbedding = internalMutation({
  args: {
    entryId: v.id("knowledgeBase"),
    embedding: v.optional(v.array(v.float64())),
    status: embeddingStatusValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entryId, {
      embedding: args.embedding,
      embeddingStatus: args.status,
      updatedAt: Date.now(),
    });
  },
});

// ── Actions ───────────────────────────────────────────────────────────────────

export const searchByEmbedding = action({
  args: {
    queryEmbedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const workspace = await requireWorkspaceInAction(ctx);
    const safeLimit = Math.max(1, Math.min(25, Math.floor(args.limit)));

    const results = await ctx.vectorSearch("knowledgeBase", "by_embedding", {
      vector: args.queryEmbedding,
      limit: safeLimit,
      filter: (q) => q.eq("workspaceId", workspace._id),
    });

    type VectorSearchEntry = { entry: Doc<"knowledgeBase">; score: number };
    const entries: Array<VectorSearchEntry | null> = await Promise.all(
      results.map(async (result) => {
        const entry = await ctx.runQuery(internal.knowledgeBase.getByIdInternal, {
          entryId: result._id,
        });
        return entry ? { entry, score: result._score } : null;
      }),
    );
    return entries.filter((entry): entry is VectorSearchEntry => entry !== null);
  },
});

export const generateAndStoreEmbedding = internalAction({
  args: { entryId: v.id("knowledgeBase") },
  handler: async (ctx, args) => {
    const entry = await ctx.runQuery(internal.knowledgeBase.getByIdInternal, {
      entryId: args.entryId,
    });
    if (!entry) return;

    try {
      // Dynamic import so the module is resolved at runtime inside Convex
      const { generateEmbedding } = await import("../lib/ai/embedding");
      const text = `${entry.title}\n${entry.content}`;
      const embedding = await generateEmbedding(text);
      await ctx.runMutation(internal.knowledgeBase.storeEmbedding, {
        entryId: args.entryId,
        embedding,
        status: "ready",
      });
    } catch (err) {
      console.error("[knowledgeBase] embedding failed:", err);
      await ctx.runMutation(internal.knowledgeBase.storeEmbedding, {
        entryId: args.entryId,
        embedding: undefined,
        status: "failed",
      });
    }
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

async function requireWorkspaceInAction(
  ctx: ActionCtx,
): Promise<Doc<"workspaces">> {
  const workspace = await ctx.runQuery(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    throw new Error("Workspace not found");
  }
  return workspace;
}
