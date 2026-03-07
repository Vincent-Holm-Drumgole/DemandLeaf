"use node";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { generateEmbedding } from "../lib/ai/embedding";
import { buildKnowledgeBaseEmbeddingChunks } from "../lib/knowledge-base/chunking";

export const generateAndStoreEmbedding = internalAction({
  args: { entryId: v.id("knowledgeBase") },
  handler: async (ctx, args) => {
    const entry = await ctx.runQuery(internal.knowledgeBase.getByIdInternal, {
      entryId: args.entryId,
    });
    if (!entry) return;

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
        chunks: embeddedChunks,
        status: "ready",
      });
    } catch (err) {
      console.error("[knowledgeBase] embedding failed:", err);
      await ctx.runMutation(internal.knowledgeBase.replaceChunksAndStatus, {
        entryId: entry._id,
        workspaceId: entry.workspaceId,
        chunks: [],
        status: "failed",
      });
    }
  },
});
