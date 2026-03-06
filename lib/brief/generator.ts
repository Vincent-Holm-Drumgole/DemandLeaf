import { callAI } from "@/lib/ai/client";
import { generateEmbedding } from "@/lib/ai/embedding";
import { getSerpResults } from "@/lib/seo-data";
import { detectCannibalization } from "@/lib/strategy/cannibalization-detector";
import { selectKBContext } from "@/lib/knowledge-base/context-selector";
import {
  BRIEF_GENERATION_SYSTEM_PROMPT,
  buildBriefGenerationPrompt,
} from "@/lib/ai/prompts/briefGeneration";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Archetype, BriefData, SearchIntent } from "@/types";
import type { ConvexHttpClient } from "convex/browser";
import { isBriefData } from "./validate";

const INTENT_ARCHETYPE: Record<SearchIntent, Archetype> = {
  informational: "how_to",
  transactional: "how_to",
  commercial: "comparison",
  navigational: "thought_leadership",
};

/**
 * Generates a 17-component content brief for a keyword.
 *
 * Pipeline:
 * 1. Load keyword + strategy from Convex
 * 2. Fetch SERP results (DataForSEO, cached 7d)
 * 3. Detect cannibalization (cosine similarity vs existing blogs)
 * 4. Vector-search knowledge base → selectKBContext
 * 5. Load voice profile + never-say terms
 * 6. Call Sonnet with briefGeneration prompt
 * 7. Parse + return BriefData
 */
export async function generateBrief(
  convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  keywordId: Id<"keywords">
): Promise<BriefData> {
  // 1. Load keyword and strategy
  const keyword = await convex.query(api.keywords.getById, { keywordId });
  if (!keyword) throw new Error(`Keyword not found: ${keywordId}`);
  const strategy = await convex.query(api.strategies.getById, { strategyId: keyword.strategyId });
  if (!strategy) throw new Error(`Strategy not found for keyword: ${keywordId}`);

  const keywordText: string = keyword.keyword;
  const intent: SearchIntent = (keyword.searchIntent as SearchIntent) ?? "informational";

  // 2–3. Run SERP fetch and cannibalization check in parallel
  const [serpResults, cannibalizationResult] = await Promise.all([
    getSerpResults(convex, keywordText).catch(() => []),
    detectCannibalization(convex, workspaceId, keywordText).catch(() => ({
      hasCannibalization: false,
      overlappingBlogs: [],
    })),
  ]);

  // 4. KB context
  let kbContextTitles: string[] = [];
  try {
    const queryEmbedding = await generateEmbedding(keywordText);
    const kbCandidates = await convex.action(api.knowledgeBase.searchByEmbedding, {
      workspaceId,
      queryEmbedding,
      limit: 10,
    });
    if (kbCandidates.length > 0) {
      const kbContext = selectKBContext(kbCandidates, INTENT_ARCHETYPE[intent]);
      kbContextTitles = kbContext.items.map(
        (item: { title: string }) => item.title
      );
    }
  } catch {
    // KB context is non-critical — proceed without it
  }

  // 5. Load voice profile and never-say terms
  const [voiceProfile, neverSayEntries] = await Promise.all([
    convex.query(api.voiceProfiles.getByWorkspace, { workspaceId }).catch(() => null),
    convex.query(api.neverSayList.getAllTerms, { workspaceId }).catch(() => []),
  ]);

  const cannibalizationNote =
    cannibalizationResult.hasCannibalization
      ? `This keyword overlaps with: ${cannibalizationResult.overlappingBlogs
          .map((b: { title: string }) => b.title)
          .join(", ")}`
      : undefined;

  // 6. Call Sonnet
  const userMessage = buildBriefGenerationPrompt({
    keyword: keywordText,
    searchVolume: keyword.searchVolume ?? 0,
    keywordDifficulty: keyword.keywordDifficulty ?? 0,
    cpc: keyword.cpc ?? 0,
    opportunityScore: keyword.opportunityScore ?? 0,
    intent,
    serpResults,
    kbContextTitles,
    businessOutcomes: strategy.businessOutcomes,
    voiceDescription: voiceProfile?.voiceDescription ?? "",
    neverSayTerms: neverSayEntries,
    cannibalizationNote,
  });

  const result = await callAI({
    model: "sonnet",
    systemPrompt: BRIEF_GENERATION_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 4096,
  });

  // 7. Parse response
  const text = result.content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  let parsed: BriefData;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn("[generateBrief] Raw AI response (parse failed):", text.slice(0, 500));
    throw new Error("Brief generation returned invalid JSON");
  }

  if (!isBriefData(parsed)) {
    throw new Error("Brief generation returned invalid brief shape");
  }

  // Ensure cannibalization note is present if detected
  if (cannibalizationNote && !parsed.cannibalizationNote) {
    parsed.cannibalizationNote = cannibalizationNote;
  }

  return parsed;
}
