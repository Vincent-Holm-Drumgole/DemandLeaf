import type { SearchIntent } from "@/types";

/**
 * Calculates the opportunity score for a keyword.
 *
 * Formula: searchVolume × (1 - keywordDifficulty / 100) × intentRelevance
 *
 * Intent relevance multipliers:
 *   transactional / commercial  →  1.0  (highest purchase signal)
 *   informational               →  0.7  (awareness value)
 *   navigational                →  0.3  (low acquisition potential)
 */
export function scoreOpportunity(
  searchVolume: number,
  keywordDifficulty: number,
  intent: SearchIntent
): number {
  const intentRelevance: Record<SearchIntent, number> = {
    transactional: 1.0,
    commercial: 1.0,
    informational: 0.7,
    navigational: 0.3,
  };
  const clampedKd = Math.max(0, Math.min(100, keywordDifficulty));
  const score = searchVolume * (1 - clampedKd / 100) * (intentRelevance[intent] ?? 0.5);
  return Math.round(score * 100) / 100; // 2 dp
}
