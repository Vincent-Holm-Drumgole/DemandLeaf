import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { ERR_ENTRY_NOT_FOUND } from "./errors";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import {
  embeddingStatusValidator,
  kbEntryTypeValidator,
} from "./validators";
import { MAX_KB_IMPORT_ENTRIES } from "../lib/knowledge-base/constants";

const MAX_KB_ENTRIES_PER_QUERY = 500;

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
        .take(MAX_KB_ENTRIES_PER_QUERY);
    }
    return ctx.db
      .query("knowledgeBase")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(MAX_KB_ENTRIES_PER_QUERY);
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
      .take(MAX_KB_ENTRIES_PER_QUERY);
  },
});

export const listReadyByWorkspaceForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("knowledgeBase")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("embeddingStatus", "ready"),
      )
      .take(MAX_KB_ENTRIES_PER_QUERY);
  },
});

export const getByIdInternal = internalQuery({
  args: { entryId: v.id("knowledgeBase") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.entryId);
  },
});

export const getChunkByIdInternal = internalQuery({
  args: { chunkId: v.id("knowledgeBaseChunks") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.chunkId);
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
    await ctx.scheduler.runAfter(0, internal.knowledgeBaseEmbeddings.generateAndStoreEmbedding, {
      entryId,
    });
    return entryId;
  },
});

export const createMany = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    entries: v.array(
      v.object({
        entryType: kbEntryTypeValidator,
        title: v.string(),
        content: v.string(),
        tags: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entries = args.entries.slice(0, MAX_KB_IMPORT_ENTRIES);
    const now = Date.now();
    const entryIds = await Promise.all(
      entries.map((entry) =>
        ctx.db.insert("knowledgeBase", {
          workspaceId: args.workspaceId,
          entryType: entry.entryType,
          title: entry.title,
          content: entry.content,
          tags: entry.tags,
          embeddingStatus: "pending",
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );

    await Promise.all(
      entryIds.map((entryId) =>
        ctx.scheduler.runAfter(0, internal.knowledgeBaseEmbeddings.generateAndStoreEmbedding, {
          entryId,
        }),
      ),
    );

    return entryIds;
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
      throw new ConvexError(ERR_ENTRY_NOT_FOUND);
    }
    const embeddingInputChanged =
      (args.title !== undefined && args.title !== entry.title) ||
      (args.content !== undefined && args.content !== entry.content);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.content !== undefined) patch.content = args.content;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (embeddingInputChanged) {
      patch.embedding = undefined;
      patch.embeddingStatus = "pending";
    }
    await ctx.db.patch(args.entryId, patch);

    if (embeddingInputChanged) {
      const existingChunks = await ctx.db
        .query("knowledgeBaseChunks")
        .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
        .collect();
      await Promise.all(existingChunks.map((chunk) => ctx.db.delete(chunk._id)));
      await ctx.scheduler.runAfter(0, internal.knowledgeBaseEmbeddings.generateAndStoreEmbedding, {
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
      throw new ConvexError(ERR_ENTRY_NOT_FOUND);
    }

    const chunks = await ctx.db
      .query("knowledgeBaseChunks")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();

    await Promise.all(chunks.map((chunk) => ctx.db.delete(chunk._id)));
    await ctx.db.delete(args.entryId);
  },
});

export const replaceChunksAndStatus = internalMutation({
  args: {
    entryId: v.id("knowledgeBase"),
    workspaceId: v.id("workspaces"),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        content: v.string(),
        embedding: v.array(v.float64()),
      }),
    ),
    status: embeddingStatusValidator,
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.workspaceId !== args.workspaceId) {
      return;
    }

    const existingChunks = await ctx.db
      .query("knowledgeBaseChunks")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();
    await Promise.all(existingChunks.map((chunk) => ctx.db.delete(chunk._id)));

    const now = Date.now();
    await Promise.all(
      args.chunks.map((chunk) =>
        ctx.db.insert("knowledgeBaseChunks", {
          workspaceId: args.workspaceId,
          entryId: args.entryId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: chunk.embedding,
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );

    await ctx.db.patch(args.entryId, {
      embedding: args.chunks[0]?.embedding,
      embeddingStatus: args.status,
      updatedAt: now,
    });
  },
});

export const retryFailedEmbeddings = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const failedEntries = await ctx.db
      .query("knowledgeBase")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("embeddingStatus", "failed"),
      )
      .collect();

    const now = Date.now();
    for (const entry of failedEntries) {
      const chunks = await ctx.db
        .query("knowledgeBaseChunks")
        .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
        .collect();
      await Promise.all(chunks.map((chunk) => ctx.db.delete(chunk._id)));
      await ctx.db.patch(entry._id, {
        embedding: undefined,
        embeddingStatus: "pending",
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.knowledgeBaseEmbeddings.generateAndStoreEmbedding, {
        entryId: entry._id,
      });
    }

    return { queued: failedEntries.length };
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
    const workspace = await requireWorkspaceInAction(ctx, args.workspaceId);
    const safeLimit = Math.max(1, Math.min(25, Math.floor(args.limit)));

    const results = await ctx.vectorSearch("knowledgeBaseChunks", "by_embedding", {
      vector: args.queryEmbedding,
      limit: safeLimit * 4,
      filter: (q) => q.eq("workspaceId", workspace._id),
    });

    type VectorSearchEntry = { entry: Doc<"knowledgeBase">; score: number };
    const entries = new Map<string, VectorSearchEntry>();

    const hydrated = await Promise.all(
      results.map(async (result) => {
        const chunk = await ctx.runQuery(internal.knowledgeBase.getChunkByIdInternal, {
          chunkId: result._id,
        });
        if (!chunk) return null;
        const entry = await ctx.runQuery(internal.knowledgeBase.getByIdInternal, {
          entryId: chunk.entryId,
        });
        if (!entry || entry.embeddingStatus !== "ready") return null;
        return { entry, score: result._score };
      }),
    );

    for (const hydratedEntry of hydrated) {
      if (!hydratedEntry) continue;
      const existing = entries.get(hydratedEntry.entry._id);
      if (!existing || hydratedEntry.score > existing.score) {
        entries.set(hydratedEntry.entry._id, hydratedEntry);
      }
    }

    return [...entries.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit);
  },
});


async function requireWorkspaceInAction(
  ctx: ActionCtx,
  workspaceId: Doc<"workspaces">["_id"],
): Promise<Doc<"workspaces">> {
  const workspace = await ctx.runQuery(api.workspaces.getByIdForViewer, { workspaceId });
  if (!workspace) {
    throw new Error("Workspace not found");
  }
  return workspace;
}
