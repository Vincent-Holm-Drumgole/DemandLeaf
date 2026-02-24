import { getRelatedKeywords, getDomainKeywords } from "@/lib/seo-data";
import type { ConvexHttpClient } from "convex/browser";

type ConvexClient = ConvexHttpClient;

/**
 * Expands seed keywords and competitor domains into a deduplicated list of
 * up to 500 candidate keywords via DataForSEO Labs API.
 */
export async function discoverKeywords(
  convex: ConvexClient,
  seeds: string[],
  competitorDomains: string[]
): Promise<string[]> {
  const discovered = new Set<string>();

  // Expand seed keywords in parallel
  const seedResults = await Promise.allSettled(
    seeds.map((seed) => getRelatedKeywords(convex, seed))
  );
  for (const result of seedResults) {
    if (result.status === "fulfilled") {
      for (const kw of result.value) discovered.add(kw.toLowerCase().trim());
    }
  }

  // Expand competitor domains in parallel
  const domainResults = await Promise.allSettled(
    competitorDomains.map((domain) => getDomainKeywords(convex, domain))
  );
  for (const result of domainResults) {
    if (result.status === "fulfilled") {
      for (const kw of result.value) discovered.add(kw.toLowerCase().trim());
    }
  }

  // Remove seeds themselves and cap at 500
  const seedSet = new Set(seeds.map((s) => s.toLowerCase().trim()));
  return Array.from(discovered)
    .filter((kw) => !seedSet.has(kw) && kw.length > 0)
    .slice(0, 500);
}
