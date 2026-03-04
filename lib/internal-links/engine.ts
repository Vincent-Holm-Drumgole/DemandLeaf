import { generateEmbedding } from "@/lib/ai/embedding";
import { api } from "@/convex/_generated/api";
import type { InternalLinkSuggestion } from "@/types";
import type { Id } from "@/convex/_generated/dataModel";
import type { ConvexHttpClient } from "convex/browser";

const MAX_BLOGS_TO_SCAN = 200;
const MIN_SIMILARITY = 0.72;
const MAX_SUGGESTIONS = 5;
const CONCURRENCY = 15;

function cosineSimilarity(a: number[], b: number[]): number {
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
 * Find 2-5 workspace blogs semantically related to the source blog.
 * Uses focusKeyword embeddings + cosine similarity. No LLM cost.
 */
export async function findInternalLinks(
  convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  sourceBlogId: Id<"blogs">,
  sourceFocusKeyword: string,
  options?: { cronKey?: string }
): Promise<InternalLinkSuggestion[]> {
  const [sourceEmbedding, allBlogs] = await Promise.all([
    generateEmbedding(sourceFocusKeyword),
    options?.cronKey
      ? convex.query(api.blogs.listPublishedForCron, {
          workspaceId,
          cronKey: options.cronKey,
        })
      : convex.query(api.blogs.listByWorkspaceId, { workspaceId }),
  ]);

  const candidates = allBlogs
    .filter(
      (b) =>
        b._id !== sourceBlogId &&
        b.focusKeyword &&
        b.slug &&
        b.status !== "draft"
    )
    .slice(0, MAX_BLOGS_TO_SCAN);

  const scored: (InternalLinkSuggestion & { _sim: number })[] = [];
  const queue = [...candidates];

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const blog = queue.shift();
        if (!blog?.focusKeyword) continue;
        try {
          const targetEmb = await generateEmbedding(blog.focusKeyword);
          const sim = cosineSimilarity(sourceEmbedding, targetEmb);
          if (sim >= MIN_SIMILARITY) {
            scored.push({
              targetBlogId: blog._id,
              targetTitle: blog.title,
              targetSlug: blog.slug!,
              anchorText: deriveAnchorText(blog.focusKeyword, blog.title),
              similarity: Math.round(sim * 1000) / 1000,
              _sim: sim,
            });
          }
        } catch {
          // Skip blogs that fail embedding
        }
      }
    })
  );

  return scored
    .sort((a, b) => b._sim - a._sim)
    .slice(0, MAX_SUGGESTIONS)
    .map((item) => ({
      targetBlogId: item.targetBlogId,
      targetTitle: item.targetTitle,
      targetSlug: item.targetSlug,
      anchorText: item.anchorText,
      similarity: item.similarity,
    }));
}

function deriveAnchorText(focusKeyword: string, title: string): string {
  const kw = focusKeyword.trim();
  if (kw.split(/\s+/).length <= 4) return kw;
  return title.length > 50 ? title.slice(0, 50).replace(/\s\w+$/, "") + "…" : title;
}
