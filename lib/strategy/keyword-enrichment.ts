import type { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getKeywordData } from "@/lib/seo-data";
import { classifyIntents } from "@/lib/strategy/intent-classifier";
import { scoreOpportunity } from "@/lib/strategy/opportunity-scorer";
import type { SearchIntent } from "@/types";

const VALID_SEARCH_INTENTS = new Set<SearchIntent>([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);

const UPDATE_BATCH_SIZE = 25;

type KeywordMetricSeed = {
  searchVolume?: number;
  keywordDifficulty?: number;
  cpc?: number;
};

export interface KeywordEnrichmentInput extends KeywordMetricSeed {
  keywordId: Id<"keywords">;
  keyword: string;
  searchIntent?: SearchIntent | string;
  opportunityScore?: number;
}

export interface KeywordEnrichmentResult {
  updated: number;
  failures: number;
}

interface NormalizedKeywordEnrichmentInput extends KeywordMetricSeed {
  keywordId: Id<"keywords">;
  keyword: string;
  normalizedKeyword: string;
  searchIntent?: SearchIntent;
  opportunityScore?: number;
}

function normalizeSearchIntent(value: KeywordEnrichmentInput["searchIntent"]): SearchIntent | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_SEARCH_INTENTS.has(value as SearchIntent)
    ? (value as SearchIntent)
    : undefined;
}

function normalizeMetricSeed(input: KeywordMetricSeed): KeywordMetricSeed {
  return {
    searchVolume: typeof input.searchVolume === "number" && Number.isFinite(input.searchVolume)
      ? input.searchVolume
      : undefined,
    keywordDifficulty: typeof input.keywordDifficulty === "number" && Number.isFinite(input.keywordDifficulty)
      ? input.keywordDifficulty
      : undefined,
    cpc: typeof input.cpc === "number" && Number.isFinite(input.cpc)
      ? input.cpc
      : undefined,
  };
}

export async function enrichKeywordRecords(
  convex: ConvexHttpClient,
  inputs: KeywordEnrichmentInput[],
): Promise<KeywordEnrichmentResult> {
  const uniqueInputs = new Map<Id<"keywords">, NormalizedKeywordEnrichmentInput>();
  for (const input of inputs) {
    const keyword = input.keyword.trim();
    if (!keyword) continue;
    uniqueInputs.set(input.keywordId, {
      keywordId: input.keywordId,
      keyword,
      normalizedKeyword: keyword.toLowerCase(),
      searchIntent: normalizeSearchIntent(input.searchIntent),
      opportunityScore: typeof input.opportunityScore === "number" && Number.isFinite(input.opportunityScore)
        ? input.opportunityScore
        : undefined,
      ...normalizeMetricSeed(input),
    });
  }
  const normalizedInputs = Array.from(uniqueInputs.values());

  if (normalizedInputs.length === 0) {
    return { updated: 0, failures: 0 };
  }

  const keywordsNeedingMetrics = normalizedInputs
    .filter((input) =>
      input.searchVolume === undefined
      || input.keywordDifficulty === undefined
      || input.cpc === undefined,
    )
    .map((input) => input.keyword);

  const keywordsNeedingIntent = normalizedInputs
    .filter((input) => input.searchIntent === undefined)
    .map((input) => input.keyword);

  let metricsMap = new Map<string, { searchVolume: number; keywordDifficulty: number; cpc: number }>();
  if (keywordsNeedingMetrics.length > 0) {
    try {
      const metrics = await getKeywordData(convex, keywordsNeedingMetrics);
      metricsMap = new Map(metrics.map((metric) => [metric.keyword.toLowerCase(), metric]));
    } catch (err) {
      console.warn("[keyword-enrichment] keyword metrics unavailable:", err);
    }
  }

  let intents = new Map<string, SearchIntent>();
  if (keywordsNeedingIntent.length > 0) {
    try {
      intents = await classifyIntents(keywordsNeedingIntent);
    } catch (err) {
      console.warn("[keyword-enrichment] keyword intent classification unavailable:", err);
    }
  }

  let updated = 0;
  let failures = 0;

  for (let i = 0; i < normalizedInputs.length; i += UPDATE_BATCH_SIZE) {
    const batch = normalizedInputs.slice(i, i + UPDATE_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (input) => {
        const fetchedMetrics = metricsMap.get(input.normalizedKeyword);
        const searchVolume = input.searchVolume ?? fetchedMetrics?.searchVolume ?? 0;
        const keywordDifficulty = input.keywordDifficulty ?? fetchedMetrics?.keywordDifficulty ?? 0;
        const cpc = input.cpc ?? fetchedMetrics?.cpc ?? 0;
        const searchIntent = input.searchIntent ?? intents.get(input.normalizedKeyword) ?? "informational";
        const opportunityScore = input.opportunityScore
          ?? scoreOpportunity(searchVolume, keywordDifficulty, searchIntent);

        await convex.mutation(api.keywords.updateMetrics, {
          keywordId: input.keywordId,
          searchVolume,
          keywordDifficulty,
          cpc,
          opportunityScore,
          searchIntent,
        });
      }),
    );

    updated += batchResults.filter((result) => result.status === "fulfilled").length;
    failures += batchResults.filter((result) => result.status === "rejected").length;
  }

  return { updated, failures };
}
