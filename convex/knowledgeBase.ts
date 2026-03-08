import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { ActionCtx, DatabaseReader, DatabaseWriter } from "./_generated/server";
import { requireCronAccess, requireWorkspaceAccess } from "./helpers";
import { ERR_ENTRY_NOT_FOUND } from "./errors";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import {
  embeddingStatusValidator,
  kbEntryTypeValidator,
  kbCapabilityStatusValidator,
  kbClaimConfidenceValidator,
} from "./validators";
import { MAX_KB_IMPORT_ENTRIES } from "../lib/knowledge-base/constants";
import { draftKnowledgeBaseClaims } from "../lib/knowledge-base/claims";

const MAX_KB_ENTRIES_PER_QUERY = 500;
const DEFAULT_REVIEW_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

type KnowledgeBaseClaimInput = {
  statement: string;
  sourceName: string;
  sourceUrl?: string;
  confidence: "verified" | "observed" | "directional";
  lastCheckedAt: number;
  notes?: string;
};

type DbReaderContext = { db: DatabaseReader };
type DbWriterContext = { db: DatabaseWriter };

async function listClaimsForEntry(
  ctx: DbReaderContext,
  entryId: Doc<"knowledgeBase">["_id"],
) {
  return ctx.db
    .query("knowledgeBaseClaims")
    .withIndex("by_entry", (q) => q.eq("entryId", entryId))
    .collect();
}

async function serializeEntryWithClaims(
  ctx: DbReaderContext,
  entry: Doc<"knowledgeBase">,
) {
  const claims = await listClaimsForEntry(ctx, entry._id);
  return { ...entry, claims };
}

async function replaceClaimsForEntry(
  ctx: DbWriterContext,
  args: {
    workspaceId: Doc<"workspaces">["_id"];
    entryId: Doc<"knowledgeBase">["_id"];
    claims: KnowledgeBaseClaimInput[];
  },
) {
  const existingClaims = await ctx.db
    .query("knowledgeBaseClaims")
    .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
    .collect();
  await Promise.all(existingClaims.map((claim: Doc<"knowledgeBaseClaims">) => ctx.db.delete(claim._id)));

  const now = Date.now();
  await Promise.all(
    args.claims.map((claim) =>
      ctx.db.insert("knowledgeBaseClaims", {
        workspaceId: args.workspaceId,
        entryId: args.entryId,
        statement: claim.statement,
        sourceName: claim.sourceName,
        sourceUrl: claim.sourceUrl,
        confidence: claim.confidence,
        lastCheckedAt: claim.lastCheckedAt,
        notes: claim.notes,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  );
}

async function snapshotKnowledgeBaseVersion(
  ctx: DbWriterContext,
  entry: {
    workspaceId: Doc<"workspaces">["_id"];
    _id: Doc<"knowledgeBase">["_id"];
    title: string;
    content: string;
    entryType: Doc<"knowledgeBase">["entryType"];
    tags: string[];
    capabilityStatus?: Doc<"knowledgeBase">["capabilityStatus"];
    discoveryNotes?: string;
    lastVerifiedAt?: number;
  },
) {
  await ctx.db.insert("knowledgeBaseVersions", {
    workspaceId: entry.workspaceId,
    entryId: entry._id,
    title: entry.title,
    content: entry.content,
    entryType: entry.entryType,
    tags: entry.tags,
    capabilityStatus: entry.capabilityStatus ?? "current",
    discoveryNotes: entry.discoveryNotes,
    lastVerifiedAt: entry.lastVerifiedAt,
    createdAt: Date.now(),
  });
}

// ── Queries ────────────────────────────────────────────────────────────────────

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    entryType: v.optional(kbEntryTypeValidator),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entryType = args.entryType;
    const entries = entryType !== undefined
      ? await ctx.db
        .query("knowledgeBase")
        .withIndex("by_workspace_type", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("entryType", entryType)
        )
        .order("desc")
        .take(MAX_KB_ENTRIES_PER_QUERY)
      : await ctx.db
          .query("knowledgeBase")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .order("desc")
          .take(MAX_KB_ENTRIES_PER_QUERY);

    return Promise.all(entries.map((entry) => serializeEntryWithClaims(ctx, entry)));
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
    return serializeEntryWithClaims(ctx, entry);
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

export const listClaimsByEntryInternal = internalQuery({
  args: { entryId: v.id("knowledgeBase") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("knowledgeBaseClaims")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();
  },
});

export const listVersions = query({
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
    return ctx.db
      .query("knowledgeBaseVersions")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .order("desc")
      .take(50);
  },
});

export const listDueForReview = query({
  args: {
    workspaceId: v.id("workspaces"),
    olderThanMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const entries = await ctx.db
      .query("knowledgeBase")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(MAX_KB_ENTRIES_PER_QUERY);

    const cutoff = Date.now() - (args.olderThanMs ?? DEFAULT_REVIEW_WINDOW_MS);
    const dueEntries = entries.filter((entry) => (entry.lastVerifiedAt ?? entry.updatedAt) < cutoff);
    return Promise.all(dueEntries.map((entry) => serializeEntryWithClaims(ctx, entry)));
  },
});

export const listDueForReviewForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    olderThanMs: v.optional(v.number()),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const entries = await ctx.db
      .query("knowledgeBase")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(MAX_KB_ENTRIES_PER_QUERY);
    const cutoff = Date.now() - (args.olderThanMs ?? DEFAULT_REVIEW_WINDOW_MS);
    return entries.filter((entry) => (entry.lastVerifiedAt ?? entry.updatedAt) < cutoff);
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
    capabilityStatus: v.optional(kbCapabilityStatusValidator),
    discoveryNotes: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
    claims: v.optional(
      v.array(
        v.object({
          statement: v.string(),
          sourceName: v.string(),
          sourceUrl: v.optional(v.string()),
          confidence: kbClaimConfidenceValidator,
          lastCheckedAt: v.number(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
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
      embeddingError: undefined,
      embeddingVersion: 1,
      lastVerifiedAt: args.lastVerifiedAt ?? now,
      capabilityStatus: args.capabilityStatus ?? "current",
      discoveryNotes: args.discoveryNotes,
      createdAt: now,
      updatedAt: now,
    });
    const normalizedClaims = (args.claims && args.claims.length > 0)
      ? args.claims
      : draftKnowledgeBaseClaims(args.content, now);
    await replaceClaimsForEntry(ctx, {
      workspaceId: args.workspaceId,
      entryId,
      claims: normalizedClaims,
    });
    await snapshotKnowledgeBaseVersion(ctx, {
      workspaceId: args.workspaceId,
      _id: entryId,
      title: args.title,
      content: args.content,
      entryType: args.entryType,
      tags: args.tags,
      capabilityStatus: args.capabilityStatus ?? "current",
      discoveryNotes: args.discoveryNotes,
      lastVerifiedAt: args.lastVerifiedAt ?? now,
    });
    // Schedule async embedding generation
    await ctx.scheduler.runAfter(0, internal.knowledgeBaseEmbeddings.generateAndStoreEmbedding, {
      entryId,
      expectedVersion: 1,
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
          capabilityStatus: v.optional(kbCapabilityStatusValidator),
          discoveryNotes: v.optional(v.string()),
          lastVerifiedAt: v.optional(v.number()),
          claims: v.optional(
            v.array(
              v.object({
                statement: v.string(),
                sourceName: v.string(),
                sourceUrl: v.optional(v.string()),
                confidence: kbClaimConfidenceValidator,
                lastCheckedAt: v.number(),
                notes: v.optional(v.string()),
              }),
            ),
          ),
        }),
    ),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entries = args.entries.slice(0, MAX_KB_IMPORT_ENTRIES);
    const now = Date.now();
    const entryIds: Array<Doc<"knowledgeBase">["_id"]> = [];
    for (const entry of entries) {
      const entryId = await ctx.db.insert("knowledgeBase", {
          workspaceId: args.workspaceId,
          entryType: entry.entryType,
          title: entry.title,
          content: entry.content,
          tags: entry.tags,
          embeddingStatus: "pending",
          embeddingVersion: 1,
          lastVerifiedAt: entry.lastVerifiedAt ?? now,
          capabilityStatus: entry.capabilityStatus ?? "current",
          discoveryNotes: entry.discoveryNotes,
          createdAt: now,
          updatedAt: now,
        });
      entryIds.push(entryId);
      await replaceClaimsForEntry(ctx, {
        workspaceId: args.workspaceId,
        entryId,
        claims: entry.claims && entry.claims.length > 0
          ? entry.claims
          : draftKnowledgeBaseClaims(entry.content, now),
      });
      await snapshotKnowledgeBaseVersion(ctx, {
        workspaceId: args.workspaceId,
        _id: entryId,
        title: entry.title,
        content: entry.content,
        entryType: entry.entryType,
        tags: entry.tags,
        capabilityStatus: entry.capabilityStatus ?? "current",
        discoveryNotes: entry.discoveryNotes,
        lastVerifiedAt: entry.lastVerifiedAt ?? now,
      });
    }

    await Promise.all(
      entryIds.map((entryId) =>
        ctx.scheduler.runAfter(0, internal.knowledgeBaseEmbeddings.generateAndStoreEmbedding, {
          entryId,
          expectedVersion: 1,
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
    entryType: v.optional(kbEntryTypeValidator),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    capabilityStatus: v.optional(kbCapabilityStatusValidator),
    discoveryNotes: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
    claims: v.optional(
      v.array(
        v.object({
          statement: v.string(),
          sourceName: v.string(),
          sourceUrl: v.optional(v.string()),
          confidence: kbClaimConfidenceValidator,
          lastCheckedAt: v.number(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    autoDraftClaims: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_ENTRY_NOT_FOUND);
    }
    const currentEmbeddingVersion = entry.embeddingVersion ?? 0;
    const embeddingInputChanged =
      (args.title !== undefined && args.title !== entry.title) ||
      (args.content !== undefined && args.content !== entry.content);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.entryType !== undefined) patch.entryType = args.entryType;
    if (args.title !== undefined) patch.title = args.title;
    if (args.content !== undefined) patch.content = args.content;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (args.capabilityStatus !== undefined) patch.capabilityStatus = args.capabilityStatus;
    if (args.discoveryNotes !== undefined) patch.discoveryNotes = args.discoveryNotes;
    if (args.lastVerifiedAt !== undefined) patch.lastVerifiedAt = args.lastVerifiedAt;
    if (embeddingInputChanged) {
      patch.embedding = undefined;
      patch.embeddingStatus = "pending";
      patch.embeddingError = undefined;
      patch.embeddingVersion = currentEmbeddingVersion + 1;
    }
    await ctx.db.patch(args.entryId, patch);

    if (args.claims !== undefined) {
      await replaceClaimsForEntry(ctx, {
        workspaceId: args.workspaceId,
        entryId: args.entryId,
        claims: args.claims,
      });
    } else if (args.autoDraftClaims && args.content !== undefined) {
      await replaceClaimsForEntry(ctx, {
        workspaceId: args.workspaceId,
        entryId: args.entryId,
        claims: draftKnowledgeBaseClaims(args.content),
      });
    }

    const updatedEntry = await ctx.db.get(args.entryId);
    if (updatedEntry) {
      await snapshotKnowledgeBaseVersion(ctx, updatedEntry);
    }

    if (embeddingInputChanged) {
      const existingChunks = await ctx.db
        .query("knowledgeBaseChunks")
        .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
        .collect();
      await Promise.all(existingChunks.map((chunk) => ctx.db.delete(chunk._id)));
      await ctx.scheduler.runAfter(0, internal.knowledgeBaseEmbeddings.generateAndStoreEmbedding, {
        entryId: args.entryId,
        expectedVersion: currentEmbeddingVersion + 1,
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
    const claims = await ctx.db
      .query("knowledgeBaseClaims")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();
    const versions = await ctx.db
      .query("knowledgeBaseVersions")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();

    await Promise.all(chunks.map((chunk) => ctx.db.delete(chunk._id)));
    await Promise.all(claims.map((claim) => ctx.db.delete(claim._id)));
    await Promise.all(versions.map((version) => ctx.db.delete(version._id)));
    await ctx.db.delete(args.entryId);
  },
});

export const markVerified = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    entryIds: v.array(v.id("knowledgeBase")),
    verifiedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const verifiedAt = args.verifiedAt ?? Date.now();
    let updated = 0;
    for (const entryId of args.entryIds) {
      const entry = await ctx.db.get(entryId);
      if (!entry || entry.workspaceId !== args.workspaceId) {
        continue;
      }
      await ctx.db.patch(entryId, {
        lastVerifiedAt: verifiedAt,
        updatedAt: Date.now(),
      });
      const refreshedEntry = await ctx.db.get(entryId);
      if (refreshedEntry) {
        await snapshotKnowledgeBaseVersion(ctx, refreshedEntry);
      }
      updated += 1;
    }
    return { updated };
  },
});

export const replaceChunksAndStatus = internalMutation({
  args: {
    entryId: v.id("knowledgeBase"),
    workspaceId: v.id("workspaces"),
    expectedVersion: v.number(),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        content: v.string(),
        embedding: v.array(v.float64()),
      }),
    ),
    status: embeddingStatusValidator,
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.workspaceId !== args.workspaceId || (entry.embeddingVersion ?? 0) !== args.expectedVersion) {
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
      embeddingError: args.error,
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
      const currentEmbeddingVersion = entry.embeddingVersion ?? 0;
      const chunks = await ctx.db
        .query("knowledgeBaseChunks")
        .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
        .collect();
      await Promise.all(chunks.map((chunk) => ctx.db.delete(chunk._id)));
      await ctx.db.patch(entry._id, {
        embedding: undefined,
        embeddingStatus: "pending",
        embeddingError: undefined,
        embeddingVersion: currentEmbeddingVersion + 1,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.knowledgeBaseEmbeddings.generateAndStoreEmbedding, {
        entryId: entry._id,
        expectedVersion: currentEmbeddingVersion + 1,
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

    type VectorSearchClaim = {
      id: string;
      entryId: string;
      statement: string;
      sourceName: string;
      sourceUrl?: string;
      confidence: "verified" | "observed" | "directional";
      lastCheckedAt: number;
      notes?: string;
      createdAt: number;
      updatedAt: number;
    };
    type VectorSearchEntry = {
      entry: Doc<"knowledgeBase">;
      claims: VectorSearchClaim[];
      score: number;
    };
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
        const claims = await ctx.runQuery(internal.knowledgeBase.listClaimsByEntryInternal, {
          entryId: entry._id,
        });
        return {
          entry,
          claims: claims.map((claim: Doc<"knowledgeBaseClaims">) => ({
            id: claim._id,
            entryId: claim.entryId,
            statement: claim.statement,
            sourceName: claim.sourceName,
            sourceUrl: claim.sourceUrl,
            confidence: claim.confidence,
            lastCheckedAt: claim.lastCheckedAt,
            notes: claim.notes,
            createdAt: claim.createdAt,
            updatedAt: claim.updatedAt,
          })),
          score: result._score,
        };
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
