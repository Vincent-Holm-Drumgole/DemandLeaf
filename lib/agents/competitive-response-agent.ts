import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import { getSerpResults } from "@/lib/seo-data/dataforseo";
import type { CompetitiveResponsePayload } from "@/types";
import type { ConvexHttpClient } from "convex/browser";

const MAX_SERP_CALLS_PER_RUN = 25;

interface CompetitorData {
  domain: string;
  trackedKeywords: string[];
}

interface ExistingCoverage {
  keyword: string;
  hasBrief: boolean;
  hasBlog: boolean;
  briefId?: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Analyze competitor SERP presence for tracked keywords.
 * Detects new threats and recommends brief creation or updates.
 */
export async function analyzeCompetitorThreats(
  convex: ConvexHttpClient,
  strategyId: string,
  competitors: CompetitorData[],
  coverage: ExistingCoverage[]
): Promise<CompetitiveResponsePayload | null> {
  const coverageMap = new Map(coverage.map((c) => [c.keyword.toLowerCase(), c]));
  const threats: CompetitiveResponsePayload["threats"] = [];
  let serpCallCount = 0;

  for (const competitor of competitors) {
    for (const keyword of competitor.trackedKeywords) {
      if (serpCallCount >= MAX_SERP_CALLS_PER_RUN) break;

      try {
        const serpResults = await getSerpResults(convex, keyword);
        serpCallCount++;

        const competitorResult = serpResults.find(
          (r) => extractDomain(r.url) === competitor.domain && r.position <= 10
        );

        if (!competitorResult) continue;

        const existing = coverageMap.get(keyword.toLowerCase());
        if (existing?.hasBlog) continue; // Already covered with a published blog

        threats.push({
          keyword,
          competitorDomain: competitor.domain,
          competitorUrl: competitorResult.url,
          competitorPosition: competitorResult.position,
          threatType: existing?.hasBrief ? "update_needed" : "gap",
          action: existing?.hasBrief ? "update_brief" : "create_brief",
          targetBriefId: existing?.briefId,
          rationale: `${competitor.domain} ranks #${competitorResult.position} for "${keyword}"`,
        });
      } catch {
        // Skip keywords that fail SERP lookup
      }
    }
  }

  if (threats.length === 0) return null;

  // Use Haiku to prioritize and add strategic context
  const system = `You are an SEO competitive analyst. Given a list of competitor threats, rank them by urgency and add a brief strategic rationale for each.
Return JSON array: [{ "keyword": string, "urgency": "high"|"medium"|"low", "strategicNote": string }]
Return ONLY the JSON array.`;

  const user = `Threats detected:
${threats.map((t, i) => `${i + 1}. "${t.keyword}" — ${t.competitorDomain} at #${t.competitorPosition}, our coverage: ${t.threatType}`).join("\n")}`;

  try {
    const result = await callHaiku(system, user, { maxTokens: 1024, temperature: 0.3 });
    const analysis = parseJsonResponse<Array<{ keyword: string; urgency: string; strategicNote: string }>>(result.content);
    if (Array.isArray(analysis)) {
      for (const item of analysis) {
        const threat = threats.find((t) => t.keyword === item.keyword);
        if (threat) {
          threat.rationale = `[${item.urgency}] ${item.strategicNote}`;
        }
      }
    }
  } catch {
    // Keep original rationales
  }

  const digest = `## Competitive Threats — ${threats.length} detected

${threats.slice(0, 5).map((t) => `- **${t.keyword}**: ${t.competitorDomain} at #${t.competitorPosition} — ${t.action === "create_brief" ? "No coverage" : "Brief needs update"}`).join("\n")}
${threats.length > 5 ? `\n...and ${threats.length - 5} more` : ""}`;

  return { strategyId, threats, digest };
}
