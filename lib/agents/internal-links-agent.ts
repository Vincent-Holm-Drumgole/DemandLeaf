import { findInternalLinks } from "@/lib/internal-links/engine";
import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import type { InternalLinksAgentPayload } from "@/types";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Analyze a newly published blog for internal linking opportunities.
 * Uses embedding similarity (no AI cost) + Haiku for insertion placement.
 */
export async function analyzeInternalLinks(
  convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  blog: {
    _id: string;
    title: string;
    content: string;
    focusKeyword: string;
  },
  options?: { cronKey?: string }
): Promise<InternalLinksAgentPayload | null> {
  const blogId = blog._id as Id<"blogs">;
  const suggestions = await findInternalLinks(
    convex,
    workspaceId,
    blogId,
    blog.focusKeyword,
    options
  );

  if (suggestions.length === 0) return null;

  // Use Haiku to determine best insertion points
  const system = `You suggest where to insert internal links in a blog post.
For each link target, identify the best paragraph (by number, 1-indexed) for natural insertion.
Return JSON array: [{ "targetBlogId": string, "paragraphIndex": number, "insertionNote": string }]
Return ONLY the JSON array.`;

  const paragraphs = blog.content
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0 && !p.startsWith("#"));

  const paragraphSummary = paragraphs
    .slice(0, 20)
    .map((p, i) => `${i + 1}. ${p.slice(0, 100)}...`)
    .join("\n");

  const user = `Blog: "${blog.title}"

Paragraphs:
${paragraphSummary}

Links to insert:
${suggestions.map((s, i) => `${i + 1}. "${s.anchorText}" → "${s.targetTitle}"`).join("\n")}`;

  let insertionNotes: Array<{
    targetBlogId: string;
    paragraphIndex: number;
    insertionNote: string;
  }> = [];

  try {
    const result = await callHaiku(system, user, {
      maxTokens: 512,
      temperature: 0.3,
    });
    insertionNotes = parseJsonResponse(result.content);
    if (!Array.isArray(insertionNotes)) insertionNotes = [];
  } catch {
    // Fallback: assign sequential paragraphs
    insertionNotes = suggestions.map((s, i) => ({
      targetBlogId: s.targetBlogId,
      paragraphIndex: Math.max(1, Math.min(i * 3 + 2, paragraphs.length || 1)),
      insertionNote: `Insert near paragraph ${Math.max(1, Math.min(i * 3 + 2, paragraphs.length || 1))}`,
    }));
  }

  return {
    blogId: blog._id,
    blogTitle: blog.title,
    suggestions: suggestions.map((s, i) => ({
      internalLinkId: s.targetBlogId,
      targetBlogTitle: s.targetTitle,
      anchorText: s.anchorText,
      similarity: s.similarity,
      insertionNote:
        insertionNotes[i]?.insertionNote ??
        `Near paragraph ${Math.max(1, Math.min(i + 2, paragraphs.length || 1))}`,
    })),
  };
}
