import { sanitizePromptInput, sanitizeXmlContent } from "./sanitize";
import type { SerpResult, SearchIntent } from "@/types";

export const BRIEF_GENERATION_SYSTEM_PROMPT = `You are a senior SEO content strategist. Your job is to produce a comprehensive, actionable content brief that a skilled writer can execute without additional research.

Output ONLY a valid JSON object matching the schema below. No explanation, no markdown — pure JSON.

Schema:
{
  "targetKeyword": string,
  "searchIntent": "informational" | "commercial" | "transactional" | "navigational",
  "buyerStage": "awareness" | "consideration" | "decision",
  "keywordDifficulty": number,
  "searchVolume": number,
  "cpc": number,
  "opportunityScore": number,
  "serpAnalysis": [{ "position": number, "title": string, "url": string, "snippet": string }],
  "contentGap": string,
  "uniqueAngle": string,
  "archetypeRecommendation": string,
  "outline": [{ "heading": string, "level": 2 | 3, "subheadings": string[] }],
  "hookOptions": [string, string, string],
  "kbContext": [string],
  "internalLinkOpportunities": [string],
  "estimatedWordCount": number,
  "citationNeeds": string,
  "successCriteria": string,
  "cannibalizationNote": string | null
}`;

interface BriefGenerationInput {
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  opportunityScore: number;
  intent: SearchIntent;
  serpResults: SerpResult[];
  kbContextTitles: string[];
  businessOutcomes: string;
  voiceDescription: string;
  neverSayTerms: string[];
  cannibalizationNote?: string;
}

export function buildBriefGenerationPrompt(input: BriefGenerationInput): string {
  const serpSummary = input.serpResults
    .slice(0, 10)
    .map((r) => `${r.position}. ${sanitizePromptInput(r.title)} — ${sanitizePromptInput(r.snippet)}`)
    .join("\n");

  const kbSection =
    input.kbContextTitles.length > 0
      ? `<knowledge_base>\n${input.kbContextTitles.map((t) => `- ${sanitizeXmlContent(t)}`).join("\n")}\n</knowledge_base>`
      : "";

  const neverSaySection =
    input.neverSayTerms.length > 0
      ? `Never use these terms: ${input.neverSayTerms.map((t) => sanitizePromptInput(t)).join(", ")}`
      : "";

  const cannibalizationSection = input.cannibalizationNote
    ? `\nCANNIBALIZATION ALERT: ${sanitizePromptInput(input.cannibalizationNote)}`
    : "";

  return `Generate a complete 17-component content brief for the following keyword.

<keyword_data>
Keyword: ${sanitizePromptInput(input.keyword)}
Search intent: ${input.intent}
Search volume: ${input.searchVolume}/mo
Keyword difficulty: ${input.keywordDifficulty}/100
CPC: $${input.cpc}
Opportunity score: ${input.opportunityScore}
</keyword_data>

<serp_top10>
${serpSummary}
</serp_top10>

${kbSection}

<strategy_context>
Business outcomes: ${sanitizeXmlContent(input.businessOutcomes)}
Brand voice: ${sanitizeXmlContent(input.voiceDescription)}
${neverSaySection}
</strategy_context>
${cannibalizationSection}

Produce the JSON brief. The uniqueAngle must reference the knowledge base if entries are present. The outline must have at least 4 H2s. hookOptions must contain exactly 3 items. estimatedWordCount must be appropriate for the archetype.`;
}
