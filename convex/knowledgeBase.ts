import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { kbEntryTypeValidator } from "./validators";

// ── Queries ────────────────────────────────────────────────────────────────────

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    entryType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.entryType) {
      return ctx.db
        .query("knowledgeBase")
        .withIndex("by_workspace_type", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("entryType", args.entryType!)
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
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.workspaceId !== args.workspaceId) return null;
    return entry;
  },
});

export const listReadyByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
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
    embedding: v.array(v.float64()),
    status: v.string(),
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
    workspaceId: v.id("workspaces"),
    queryEmbedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.vectorSearch("knowledgeBase", "by_embedding", {
      vector: args.queryEmbedding,
      limit: args.limit,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });
    // Fetch full entry data for each result
    const entries = await Promise.all(
      results.map(async (r) => {
        const entry = await ctx.runQuery(internal.knowledgeBase.getByIdInternal, {
          entryId: r._id,
        });
        return entry ? { entry, score: r._score } : null;
      })
    );
    return entries.filter((e): e is NonNullable<typeof e> => e !== null);
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
        embedding: [],
        status: "failed",
      });
    }
  },
});
