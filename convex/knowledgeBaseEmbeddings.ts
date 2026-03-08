"use node";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { generateEmbedding } from "../lib/ai/embedding";
import { buildKnowledgeBaseEmbeddingChunks } from "../lib/knowledge-base/chunking";

export const generateAndStoreEmbedding = internalAction({
  args: {
    entryId: v.id("knowledgeBase"),
    expectedVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.runQuery(internal.knowledgeBase.getByIdInternal, {
      entryId: args.entryId,
    });
    if (!entry || (entry.embeddingVersion ?? 0) !== args.expectedVersion) return;

    try {
      const chunks = buildKnowledgeBaseEmbeddingChunks(entry.content);
      const embeddedChunks = await Promise.all(
        chunks.map(async (chunk) => ({
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: await generateEmbedding(`${entry.title}\n${chunk.content}`),
        })),
      );

      await ctx.runMutation(internal.knowledgeBase.replaceChunksAndStatus, {
        entryId: entry._id,
        workspaceId: entry.workspaceId,
        expectedVersion: args.expectedVersion,
        chunks: embeddedChunks,
        status: "ready",
        error: undefined,
      });
    } catch (err) {
      console.error("[knowledgeBase] embedding failed:", err);
      await ctx.runMutation(internal.knowledgeBase.replaceChunksAndStatus, {
        entryId: entry._id,
        workspaceId: entry.workspaceId,
        expectedVersion: args.expectedVersion,
        chunks: [],
        status: "failed",
        error: err instanceof Error ? err.message.slice(0, 500) : "Embedding failed",
      });
    }
  },
});
