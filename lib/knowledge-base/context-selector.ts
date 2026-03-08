import type { Archetype, KBContextItem, KBContextResult } from "@/types";
import { DEFAULT_KB_CONTEXT_TOKEN_BUDGET } from "./constants";

interface KBEntryWithScore {
  entry: {
    _id: string;
    entryType: string;
    title: string;
    content: string;
    updatedAt: number;
    capabilityStatus?: "current" | "planned";
    discoveryNotes?: string;
  };
  claims?: KBContextItem["claims"];
  score: number;
}

// Preferred KB entry types by archetype — boosts relevance score
const ARCHETYPE_KB_AFFINITY: Record<Archetype, string[]> = {
  how_to: ["methodology", "lesson_learned", "product"],
  listicle: ["product", "industry", "competitor"],
  definitive_guide: ["industry", "methodology", "proprietary_data"],
  thought_leadership: ["thought_leadership_position", "hot_take", "expert_insight"],
  comparison: ["competitor", "product", "audience"],
  data_study: ["proprietary_data", "industry", "expert_insight"],
  case_study: ["customer_story", "lesson_learned", "product"],
  news_commentary: ["industry", "hot_take", "thought_leadership_position"],
};

const AFFINITY_BOOST = 0.15;
const RECENCY_BOOST = 0.10;
const RECENCY_WINDOW_DAYS = 30;
const CHARS_PER_TOKEN_ESTIMATE = 4;

/**
 * Select the most relevant KB entries for a given keyword + archetype.
 *
 * Algorithm:
 * 1. Take up to top 10 candidates by cosine similarity
 * 2. Apply archetype affinity boost (+0.15) for preferred entry types
 * 3. Apply recency boost (+0.10) for entries updated within 30 days, scaled by freshness
 * 4. Re-sort by adjusted score
 * 5. Greedily select entries until token budget exhausted
 */
export function selectKBContext(
  candidates: KBEntryWithScore[],
  archetype: Archetype,
  maxTokenBudget = DEFAULT_KB_CONTEXT_TOKEN_BUDGET
): KBContextResult {
  // Take top 10 by original similarity score
  const top10 = candidates.slice(0, 10);
  const now = Date.now();
  const recencyWindowMs = RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const affinityTypes = ARCHETYPE_KB_AFFINITY[archetype] ?? [];

  // Apply boosts and re-rank
  const reranked = top10
    .map(({ entry, score, claims }) => {
      let adjusted = score;
      if (affinityTypes.includes(entry.entryType)) {
        adjusted += AFFINITY_BOOST;
      }
      const ageMs = now - entry.updatedAt;
      if (ageMs < recencyWindowMs) {
        const freshness = 1 - ageMs / recencyWindowMs;
        adjusted += RECENCY_BOOST * freshness;
      }
      return { entry, claims, score: adjusted };
    })
    .sort((a, b) => b.score - a.score);

  // Greedily select within token budget
  const selected: KBContextItem[] = [];
  let totalChars = 0;
  const charBudget = maxTokenBudget * CHARS_PER_TOKEN_ESTIMATE;

  for (const { entry, score, claims } of reranked) {
    const entryChars = entry.title.length + entry.content.length + 50; // 50 for formatting
    if (totalChars + entryChars > charBudget) continue;
    selected.push({
      entryId: entry._id,
      entryType: entry.entryType as KBContextItem["entryType"],
      title: entry.title,
      content: entry.content,
      capabilityStatus: entry.capabilityStatus ?? "current",
      discoveryNotes: entry.discoveryNotes,
      claims: claims ?? [],
      similarityScore: score,
    });
    totalChars += entryChars;
  }

  return {
    items: selected,
    totalTokens: Math.ceil(totalChars / CHARS_PER_TOKEN_ESTIMATE),
    truncated: reranked.length > selected.length,
  };
}
