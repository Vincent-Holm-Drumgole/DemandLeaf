import { ARCHETYPE_LIST } from "@/lib/constants/archetypes";
import type { CalendarItem, ClusterResult } from "@/types";

interface KeywordEntry {
  keywordId: string;
  keyword: string;
  opportunityScore: number;
}

/**
 * Generates a content calendar from clustered keywords.
 *
 * Algorithm:
 * 1. Flatten all keywords from clusters, preserving cluster order (pillar first)
 * 2. Sort within each cluster by opportunityScore DESC
 * 3. Assign archetypes cycling through all 8, balancing funnel stages
 * 4. Spread across months starting from startDate at postsPerMonth cadence
 */
export function generateCalendar(
  clusters: ClusterResult[],
  keywordEntries: KeywordEntry[],
  startDate: Date,
  postsPerMonth: number
): CalendarItem[] {
  if (keywordEntries.length === 0) return [];
  if (postsPerMonth <= 0) throw new Error("postsPerMonth must be a positive integer");

  const entryMap = new Map(keywordEntries.map((e) => [e.keyword, e]));

  // Build ordered keyword list: pillar keywords first, then satellites, sorted by score
  const ordered: KeywordEntry[] = [];
  const seen = new Set<string>();

  for (const cluster of clusters) {
    const clusterEntries = cluster.keywords
      .map((kw) => entryMap.get(kw))
      .filter((e): e is KeywordEntry => e !== undefined)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
    // Pillar first
    const pillar = clusterEntries.find((e) => e.keyword === cluster.pillarKeyword);
    if (pillar && !seen.has(pillar.keyword)) {
      ordered.push(pillar);
      seen.add(pillar.keyword);
    }
    for (const entry of clusterEntries) {
      if (!seen.has(entry.keyword)) {
        ordered.push(entry);
        seen.add(entry.keyword);
      }
    }
  }

  // Any keywords not in clusters (edge case)
  for (const entry of keywordEntries) {
    if (!seen.has(entry.keyword)) ordered.push(entry);
  }

  // Assign archetypes cycling through funnel stages: Top → Top-Mid → Mid → Bottom
  const archetypesByStage = {
    Top: ARCHETYPE_LIST.filter((a) => a.funnelStage === "Top"),
    TopMid: ARCHETYPE_LIST.filter((a) => a.funnelStage === "Top-Mid"),
    Mid: ARCHETYPE_LIST.filter((a) => a.funnelStage === "Middle"),
    Bottom: ARCHETYPE_LIST.filter((a) => a.funnelStage === "Bottom"),
  };
  const archetypeCycle = [
    ...archetypesByStage.Top,
    ...archetypesByStage.TopMid,
    ...archetypesByStage.Mid,
    ...archetypesByStage.Bottom,
  ];
  if (archetypeCycle.length === 0) {
    throw new Error("ARCHETYPE_LIST has no entries matching known funnel stages");
  }

  const items: CalendarItem[] = [];
  const msPerMonth = 30 * 24 * 60 * 60 * 1000;
  const startMs = startDate.getTime();

  for (let i = 0; i < ordered.length; i++) {
    const entry = ordered[i];
    const monthOffset = Math.floor(i / postsPerMonth);
    const positionInMonth = i % postsPerMonth;
    const daysIntoMonth = Math.floor((positionInMonth / postsPerMonth) * 28);
    const scheduledDate = startMs + monthOffset * msPerMonth + daysIntoMonth * 24 * 60 * 60 * 1000;
    const archetype = archetypeCycle[i % archetypeCycle.length];

    items.push({
      keywordId: entry.keywordId,
      keyword: entry.keyword,
      archetype: archetype.id,
      scheduledDate,
      priority: i + 1,
    });
  }

  return items;
}
