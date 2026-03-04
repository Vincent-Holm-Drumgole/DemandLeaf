import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import type { InternalLinksAgentPayload } from "@/types";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Execute an approved internal links action.
 * Upserts link suggestions into the internalLinks table as "accepted".
 */
export async function executeInternalLinks(
  convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  payload: InternalLinksAgentPayload
): Promise<{ applied: number; skipped: number }> {
  const sourceBlogId = parseConvexId(payload.blogId, "blogs");
  if (!sourceBlogId) return { applied: 0, skipped: payload.suggestions.length };

  const validSuggestions = payload.suggestions
    .map((s) => {
      const targetId = parseConvexId(s.internalLinkId, "blogs");
      return targetId
        ? {
            targetBlogId: targetId,
            anchorText: s.anchorText,
            similarity: s.similarity,
          }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (validSuggestions.length === 0) {
    return { applied: 0, skipped: payload.suggestions.length };
  }

  await convex.mutation(api.internalLinks.upsertSuggestions, {
    workspaceId,
    sourceBlogId,
    suggestions: validSuggestions,
  });

  return { applied: validSuggestions.length, skipped: payload.suggestions.length - validSuggestions.length };
}
