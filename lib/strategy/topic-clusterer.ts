import { generateEmbedding } from "@/lib/ai/embedding";
import { kmeans } from "ml-kmeans";
import type { ClusterResult } from "@/types";

interface KeywordWithScore {
  keyword: string;
  opportunityScore: number;
}

const EMBEDDING_CONCURRENCY = 20;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Groups keywords into topic clusters using OpenAI embeddings + k-means.
 *
 * k heuristic: Math.max(3, Math.ceil(Math.sqrt(n / 5)))
 *   e.g. 20 keywords → k=2 floored to 3, 50 keywords → k=3, 100 keywords → k=4
 *
 * The pillar keyword for each cluster is the one with the highest opportunityScore.
 */
export async function clusterKeywords(
  keywordsWithScores: KeywordWithScore[]
): Promise<ClusterResult[]> {
  if (keywordsWithScores.length === 0) return [];
  if (keywordsWithScores.length <= 3) {
    // Too few to cluster meaningfully — return one cluster
    const sorted = [...keywordsWithScores].sort((a, b) => b.opportunityScore - a.opportunityScore);
    return [
      {
        name: sorted[0].keyword,
        pillarKeyword: sorted[0].keyword,
        keywords: keywordsWithScores.map((k) => k.keyword),
      },
    ];
  }

  // Generate embeddings for all keywords
  const embeddings = await mapWithConcurrency(
    keywordsWithScores,
    EMBEDDING_CONCURRENCY,
    async (keyword) => generateEmbedding(keyword.keyword),
  );

  const k = Math.max(3, Math.ceil(Math.sqrt(keywordsWithScores.length / 5)));
  const actualK = Math.min(k, keywordsWithScores.length);

  const result = kmeans(embeddings, actualK, { seed: 42 });

  // Group keywords by cluster
  const clusterMap = new Map<number, KeywordWithScore[]>();
  for (let i = 0; i < keywordsWithScores.length; i++) {
    const clusterId = result.clusters[i];
    if (!clusterMap.has(clusterId)) clusterMap.set(clusterId, []);
    clusterMap.get(clusterId)!.push(keywordsWithScores[i]);
  }

  const clusters: ClusterResult[] = [];
  for (const members of clusterMap.values()) {
    // Pillar = highest opportunity score in cluster
    const sorted = [...members].sort((a, b) => b.opportunityScore - a.opportunityScore);
    const pillar = sorted[0].keyword;
    clusters.push({
      name: pillar,
      pillarKeyword: pillar,
      keywords: members.map((m) => m.keyword),
    });
  }

  return clusters;
}
