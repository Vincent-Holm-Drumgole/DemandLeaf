import { generateEmbedding } from "@/lib/ai/embedding";
import { api } from "@/convex/_generated/api";
import type { CannibalizationResult } from "@/types";
import type { Id } from "@/convex/_generated/dataModel";
import type { ConvexHttpClient } from "convex/browser";

type ConvexClient = ConvexHttpClient;

export const CANNIBALIZATION_SIMILARITY_THRESHOLD = 0.85;
const EMBEDDING_CONCURRENCY = 20;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Checks whether a keyword semantically overlaps with any existing blog in the workspace.
 * Uses cosine similarity on OpenAI embeddings of the keyword vs each blog's focusKeyword.
 *
 * MVP: computes embeddings on demand per blog keyword.
 * Scale note: if workspace has many blogs, consider pre-computing and storing blog
 * keyword embeddings in the blogs table.
 */
export async function detectCannibalization(
  convex: ConvexClient,
  workspaceId: Id<"workspaces">,
  keyword: string
): Promise<CannibalizationResult> {
  const [queryEmbedding, blogs] = await Promise.all([
    generateEmbedding(keyword),
    convex.query(api.blogs.listByWorkspaceId, { workspaceId }),
  ]);

  const overlapping: { id: string; title: string; similarity: number }[] = [];

  // Embed each blog's focusKeyword and compare
  const candidates = blogs.filter((blog: { focusKeyword?: string }) => blog.focusKeyword);
  const queue = [...candidates];
  const workers = Array.from({ length: Math.min(EMBEDDING_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const blog = queue.shift();
      if (!blog || !blog.focusKeyword) continue;
      try {
        const blogEmbedding = await generateEmbedding(blog.focusKeyword);
        const similarity = cosineSimilarity(queryEmbedding, blogEmbedding);
        if (similarity >= CANNIBALIZATION_SIMILARITY_THRESHOLD) {
          overlapping.push({ id: blog._id, title: blog.title, similarity });
        }
      } catch {
        // Skip blogs whose keywords fail to embed
      }
    }
  });
  await Promise.all(workers);

  overlapping.sort((a, b) => b.similarity - a.similarity);

  return {
    hasCannibalization: overlapping.length > 0,
    overlappingBlogs: overlapping,
  };
}
