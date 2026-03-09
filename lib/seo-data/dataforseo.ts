/**
 * DataForSEO API client with Convex-backed cache.
 *
 * All methods follow a cache-first pattern:
 *   1. Query seoDataCache by cacheKey
 *   2. If hit and not expired → return cached data
 *   3. If miss or expired → fetch from DataForSEO → write cache → return data
 *
 * Cache TTLs:
 *   keyword data  30 days
 *   SERP results   7 days
 *   related kws   30 days
 *   domain kws     7 days
 *
 * DataForSEO credentials must be set in env:
 *   DATAFORSEO_LOGIN
 *   DATAFORSEO_PASSWORD
 */
import "server-only";

import { api } from "@/convex/_generated/api";
import type { KeywordMetric, SerpResult, RankCheckResult } from "@/types";
import type { ConvexHttpClient } from "convex/browser";

const BASE_URL = "https://api.dataforseo.com/v3";

const TTL_MS = {
  keyword: 30 * 24 * 60 * 60 * 1000,
  serp: 7 * 24 * 60 * 60 * 1000,
  related: 30 * 24 * 60 * 60 * 1000,
  domain: 7 * 24 * 60 * 60 * 1000,
  rank: 7 * 24 * 60 * 60 * 1000,
} as const;

function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD must be set");
  }
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

async function dfsFetch(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000), // 30s timeout
  });
  if (!res.ok) {
    throw new Error(`DataForSEO ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

type ConvexClient = ConvexHttpClient;
type SeoCacheData = KeywordMetric | SerpResult[] | string[] | RankCheckResult;

async function getCached(convex: ConvexClient, cacheKey: string): Promise<unknown | null> {
  const cached = await convex.query(api.seoDataCache.get, { cacheKey });
  return cached ?? null;
}

async function setCache(convex: ConvexClient, cacheKey: string, data: SeoCacheData, ttlMs: number): Promise<void> {
  try {
    await convex.mutation(api.seoDataCache.set, {
      cacheKey,
      data,
      expiresAt: Date.now() + ttlMs,
    });
  } catch (err) {
    // Background/cron jobs run without end-user identity and may skip cache writes.
    console.warn(`[seo-data] Cache write skipped for ${cacheKey}:`, err);
  }
}

/**
 * Fetch keyword volume, difficulty, and CPC for an array of keywords.
 * Results are cached per-keyword for 30 days.
 */
export async function getKeywordData(convex: ConvexClient, keywords: string[]): Promise<KeywordMetric[]> {
  const results: KeywordMetric[] = [];
  const toFetch: string[] = [];

  // Single Convex round-trip for all cache lookups (replaces N parallel queries).
  const cacheKeys = keywords.map((kw) => `keyword:${kw.toLowerCase()}`);
  const cacheHits = await convex.query(api.seoDataCache.getMany, { cacheKeys });
  for (const keyword of keywords) {
    const cacheKey = `keyword:${keyword.toLowerCase()}`;
    if (cacheHits[cacheKey] !== undefined) {
      results.push(cacheHits[cacheKey] as KeywordMetric);
    } else {
      toFetch.push(keyword);
    }
  }

  if (toFetch.length === 0) return results;

  // 1. Fetch search volume + CPC from Google Ads endpoint
  const volumeResponse = await dfsFetch("/keywords_data/google_ads/search_volume/live", [
    { keywords: toFetch, location_code: 2840, language_code: "en" },
  ]) as { tasks?: { result?: { keyword: string; search_volume: number; cpc: number }[] }[] };

  const volumeResult = volumeResponse.tasks?.[0]?.result ?? [];
  const volumeMap = new Map<string, { search_volume: number; cpc: number }>();
  for (const item of volumeResult) {
    volumeMap.set(item.keyword.toLowerCase(), {
      search_volume: item.search_volume ?? 0,
      cpc: item.cpc ?? 0,
    });
  }

  // 2. Fetch keyword difficulty from DataForSEO Labs bulk endpoint
  let kdMap = new Map<string, number>();
  try {
    const kdResponse = await dfsFetch("/dataforseo_labs/google/bulk_keyword_difficulty/live", [
      { keywords: toFetch, location_code: 2840, language_code: "en" },
    ]) as { tasks?: { result?: { items?: { keyword: string; keyword_difficulty: number }[] }[] }[] };

    const kdItems = kdResponse.tasks?.[0]?.result?.[0]?.items ?? [];
    kdMap = new Map(kdItems.map((item) => [item.keyword.toLowerCase(), item.keyword_difficulty ?? 0]));
  } catch (kdErr) {
    console.warn("[seo-data] Keyword difficulty fetch failed, using 0:", kdErr);
  }

  // 3. Merge volume + KD into results
  const cacheWrites: Array<Promise<void>> = [];
  for (const kw of toFetch) {
    const kwLower = kw.toLowerCase();
    const vol = volumeMap.get(kwLower);
    const metric: KeywordMetric = {
      keyword: kw,
      searchVolume: vol?.search_volume ?? 0,
      keywordDifficulty: kdMap.get(kwLower) ?? 0,
      cpc: vol?.cpc ?? 0,
    };
    results.push(metric);
    const cacheKey = `keyword:${kwLower}`;
    cacheWrites.push(setCache(convex, cacheKey, metric, TTL_MS.keyword));
  }
  await Promise.allSettled(cacheWrites);

  return results;
}

/**
 * Fetch top SERP results for a keyword. Cached for 7 days.
 */
export async function getSerpResults(convex: ConvexClient, keyword: string): Promise<SerpResult[]> {
  const cacheKey = `serp:${keyword.toLowerCase()}`;
  const cached = await getCached(convex, cacheKey);
  if (cached) return cached as SerpResult[];

  const response = await dfsFetch("/serp/google/organic/live/advanced", [
    { keyword, location_code: 2840, language_code: "en", depth: 20 },
  ]) as { tasks?: { result?: { items?: { rank_absolute: number; title: string; url: string; description: string }[] }[] }[] };

  const items = response.tasks?.[0]?.result?.[0]?.items ?? [];
  const results: SerpResult[] = items
    .filter((item) => item.title && item.url)
    .slice(0, 20)
    .map((item) => ({
      position: item.rank_absolute,
      title: item.title,
      url: item.url,
      snippet: item.description ?? "",
    }));

  await setCache(convex, cacheKey, results, TTL_MS.serp);
  return results;
}

/**
 * Discover related keywords from a seed keyword using keyword suggestions.
 * This returns topically relevant suggestions rather than loosely related keywords.
 * Cached for 30 days.
 */
export async function getRelatedKeywords(convex: ConvexClient, seed: string): Promise<string[]> {
  const cacheKey = `suggestions:${seed.toLowerCase()}`;
  const cached = await getCached(convex, cacheKey);
  if (cached) return cached as string[];

  const response = await dfsFetch("/dataforseo_labs/google/keyword_suggestions/live", [
    { keyword: seed, location_code: 2840, language_code: "en", limit: 100, include_seed_keyword: false },
  ]) as { tasks?: { result?: { items?: { keyword_data: { keyword: string; search_volume: number } }[] }[] }[] };

  const items = response.tasks?.[0]?.result?.[0]?.items ?? [];
  const keywords = items
    .map((item) => item.keyword_data?.keyword)
    .filter((k): k is string => Boolean(k) && k.toLowerCase() !== seed.toLowerCase());

  await setCache(convex, cacheKey, keywords, TTL_MS.related);
  return keywords;
}

/**
 * Discover keywords a competitor domain ranks for. Cached for 7 days.
 */
export async function getDomainKeywords(convex: ConvexClient, domain: string): Promise<string[]> {
  const cacheKey = `domain:${domain.toLowerCase()}`;
  const cached = await getCached(convex, cacheKey);
  if (cached) return cached as string[];

  const response = await dfsFetch("/dataforseo_labs/google/ranked_keywords/live", [
    { target: domain, location_code: 2840, language_code: "en", limit: 100 },
  ]) as { tasks?: { result?: { items?: { keyword_data: { keyword: string } }[] }[] }[] };

  const items = response.tasks?.[0]?.result?.[0]?.items ?? [];
  const keywords = items
    .map((item) => item.keyword_data?.keyword)
    .filter((k): k is string => Boolean(k));

  await setCache(convex, cacheKey, keywords, TTL_MS.domain);
  return keywords;
}

/**
 * Check the SERP position for a specific URL and keyword.
 * Scans top 100 results, matches by domain. Cached for 7 days.
 */
export async function checkRankPosition(
  convex: ConvexClient,
  keyword: string,
  targetUrl: string
): Promise<RankCheckResult> {
  const domain = extractDomain(targetUrl);
  const cacheKey = `rank:${domain}:${keyword.toLowerCase()}`;
  const cached = await getCached(convex, cacheKey);
  if (cached) return cached as RankCheckResult;

  const response = await dfsFetch("/serp/google/organic/live/advanced", [
    { keyword, location_code: 2840, language_code: "en", depth: 100 },
  ]) as {
    tasks?: {
      result?: {
        items?: { rank_absolute: number; url: string; title: string }[];
      }[];
    }[];
  };

  const items = response.tasks?.[0]?.result?.[0]?.items ?? [];
  const match = items.find(
    (item) => item.url && extractDomain(item.url) === domain
  );

  const result: RankCheckResult = {
    keyword,
    position: match ? match.rank_absolute : null,
    url: match?.url ?? null,
    checkedAt: Date.now(),
  };

  await setCache(
    convex,
    cacheKey,
    result,
    TTL_MS.rank
  );
  return result;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase();
  }
}
