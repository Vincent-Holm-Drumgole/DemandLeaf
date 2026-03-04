import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import type { StrategyDriftPayload } from "@/types";

interface StrategyData {
  _id: string;
  name: string;
  businessOutcomes: string;
  seedKeywords: string[];
}

interface KeywordData {
  keyword: string;
  status: string;
  searchVolume?: number;
  opportunityScore?: number;
}

interface BlogData {
  focusKeyword?: string;
  archetype: string;
  seoScore?: number;
  publishedAt?: number;
}

interface RankData {
  keyword: string;
  position?: number | null;
}

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Analyze strategy-to-execution alignment.
 * Pure code metrics + single Haiku call for pivot synthesis.
 */
export async function analyzeStrategyDrift(input: {
  strategy: StrategyData;
  keywords: KeywordData[];
  blogs: BlogData[];
  rankSnapshots: RankData[];
}): Promise<StrategyDriftPayload | null> {
  const { strategy, keywords, blogs, rankSnapshots } = input;
  if (keywords.length === 0) return null;

  // 1. Keyword coverage rate
  const coveredStatuses = ["written", "published", "ranking"];
  const coveredCount = keywords.filter((k) =>
    coveredStatuses.includes(k.status)
  ).length;
  const coverageRate = coveredCount / keywords.length;

  // 2. High-opportunity gaps
  const highOpportunityGaps = keywords
    .filter(
      (k) =>
        (k.opportunityScore ?? 0) > 70 &&
        (k.status === "unassigned" || k.status === "briefed")
    )
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
    .slice(0, 5)
    .map((k) => k.keyword);

  // 3. Archetype distribution
  const archetypeCounts = new Map<string, number>();
  for (const blog of blogs) {
    archetypeCounts.set(
      blog.archetype,
      (archetypeCounts.get(blog.archetype) ?? 0) + 1
    );
  }
  const totalBlogs = blogs.length || 1;
  const archetypeImbalances: string[] = [];
  const expectedTypes = [
    "how_to", "listicle", "definitive_guide", "thought_leadership",
    "comparison", "data_study", "case_study", "news_commentary",
  ];
  for (const type of expectedTypes) {
    const count = archetypeCounts.get(type) ?? 0;
    const pct = (count / totalBlogs) * 100;
    if (pct > 40) {
      archetypeImbalances.push(`${type} overrepresented at ${pct.toFixed(0)}%`);
    }
  }
  const unusedTypes = expectedTypes.filter(
    (t) => !archetypeCounts.has(t)
  );
  if (unusedTypes.length > 3) {
    archetypeImbalances.push(
      `${unusedTypes.length} archetypes never used: ${unusedTypes.slice(0, 3).join(", ")}`
    );
  }

  // 4. Ranking health
  const rankedKeywords = new Set<string>();
  for (const snap of rankSnapshots) {
    if (snap.position != null && snap.position <= 20) {
      rankedKeywords.add(snap.keyword);
    }
  }
  const rankingHealthRate =
    keywords.length > 0 ? rankedKeywords.size / keywords.length : 0;

  // 5. Stale content
  const now = Date.now();
  const staleCount = blogs.filter(
    (b) => b.publishedAt && now - b.publishedAt > TWELVE_MONTHS_MS
  ).length;

  // Skip if metrics look healthy
  if (
    coverageRate >= 0.6 &&
    highOpportunityGaps.length === 0 &&
    archetypeImbalances.length === 0 &&
    rankingHealthRate >= 0.3
  ) {
    return null;
  }

  // Haiku synthesis for pivot recommendations
  const system = `You are a content strategy consultant. Given strategy metrics, recommend 3 specific pivots.
Return JSON: { "pivots": [{ "type": "keyword"|"archetype"|"topic", "recommendation": string, "rationale": string }] }
Return ONLY the JSON object.`;

  const user = `Strategy: "${strategy.name}"
Business outcomes: ${strategy.businessOutcomes}
Seed keywords: ${strategy.seedKeywords.slice(0, 10).join(", ")}

Metrics:
- Keyword coverage: ${(coverageRate * 100).toFixed(0)}% (${coveredCount}/${keywords.length})
- Ranking health: ${(rankingHealthRate * 100).toFixed(0)}% keywords in top 20
- High-opportunity gaps: ${highOpportunityGaps.length > 0 ? highOpportunityGaps.join(", ") : "None"}
- Archetype issues: ${archetypeImbalances.length > 0 ? archetypeImbalances.join("; ") : "Balanced"}
- Stale posts (12+ months): ${staleCount}`;

  let pivots: StrategyDriftPayload["pivotRecommendations"] = [];
  try {
    const result = await callHaiku(system, user, {
      maxTokens: 1024,
      temperature: 0.4,
    });
    const parsed = parseJsonResponse<{ pivots: typeof pivots }>(result.content);
    if (Array.isArray(parsed.pivots)) {
      pivots = parsed.pivots.slice(0, 3);
    }
  } catch {
    pivots = [
      {
        type: "keyword",
        recommendation: "Review high-opportunity keyword gaps",
        rationale: `${highOpportunityGaps.length} high-value keywords remain uncovered`,
      },
    ];
  }

  const digest = `## Strategy Health Check — "${strategy.name}"

- **Coverage**: ${(coverageRate * 100).toFixed(0)}% of keywords covered
- **Ranking**: ${(rankingHealthRate * 100).toFixed(0)}% in top 20
- **Gaps**: ${highOpportunityGaps.length} high-opportunity keywords uncovered
${archetypeImbalances.length > 0 ? `- **Archetype issues**: ${archetypeImbalances.join("; ")}` : ""}

### Recommended Pivots
${pivots.map((p) => `- **${p.type}**: ${p.recommendation}`).join("\n")}`;

  return {
    strategyId: strategy._id,
    coverageRate,
    rankingHealthRate,
    highOpportunityGaps,
    archetypeImbalances,
    pivotRecommendations: pivots,
    digest,
  };
}
