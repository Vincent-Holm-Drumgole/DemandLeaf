import { callSonnet, parseJsonResponse } from "@/lib/ai/client";
import { buildRefreshBriefPrompt, buildRefreshDraftPrompt } from "@/lib/ai/prompts/refreshGeneration";
import { getSerpResults } from "@/lib/seo-data/dataforseo";
import { extractHeadings } from "@/lib/text-utils";
import type { RefreshBriefData } from "@/types";
import type { ConvexHttpClient } from "convex/browser";

/**
 * Generate a refresh brief using Sonnet.
 * Cost: ~$0.032 per brief (~3000 input + ~1500 output tokens).
 */
export async function generateRefreshBrief(
  convex: ConvexHttpClient,
  blog: {
    title: string;
    content: string;
    focusKeyword: string;
    wordCount: number;
    publishedAt?: number;
  },
  diagnosis: {
    cause: string;
    notes: string;
  },
  currentPosition: number | null,
  businessOutcomes: string
): Promise<RefreshBriefData> {
  const serpResults = await getSerpResults(convex, blog.focusKeyword);

  const headings = extractHeadings(blog.content);
  const currentOutline = headings
    .map((h) => `${"#".repeat(h.level)} ${h.text}`)
    .join("\n");

  const blogAgeDays = blog.publishedAt
    ? Math.floor((Date.now() - blog.publishedAt) / (24 * 60 * 60 * 1000))
    : 0;

  const { systemPrompt, userMessage } = buildRefreshBriefPrompt({
    keyword: blog.focusKeyword,
    diagnosisCause: diagnosis.cause,
    diagnosisNotes: diagnosis.notes,
    currentPosition,
    blogTitle: blog.title,
    blogAgeDays,
    wordCount: blog.wordCount ?? 0,
    serpResults,
    kbContextTitles: [],
    currentOutline,
    businessOutcomes,
  });

  const result = await callSonnet(systemPrompt, userMessage, {
    maxTokens: 4096,
    temperature: 0.4,
  });

  try {
    return parseJsonResponse<RefreshBriefData>(result.content);
  } catch {
    return {
      targetKeyword: blog.focusKeyword,
      diagnosisCause: diagnosis.cause,
      diagnosisNotes: diagnosis.notes,
      currentPosition,
      targetPosition: currentPosition ? Math.max(1, currentPosition - 10) : 10,
      sectionsToUpdate: [],
      newSectionsToAdd: [],
      sectionsToRemove: [],
      statisticsToRefresh: ["Review all statistics for currency"],
      internalLinksToAdd: [],
      externalSourcesNeeded: [],
      estimatedReworkPercent: 30,
      successCriteria: "Recover lost ranking positions within 4-8 weeks",
    };
  }
}

/**
 * Generate a full refreshed draft from the refresh brief.
 * Feeds existing content + refresh brief to Sonnet.
 */
export async function generateRefreshedDraft(
  blog: { content: string },
  refreshBrief: RefreshBriefData,
  voiceDescription: string,
  neverSayTerms: string[]
): Promise<string> {
  const { systemPrompt, userMessage } = buildRefreshDraftPrompt({
    existingContent: blog.content,
    refreshBrief,
    voiceDescription,
    neverSayTerms,
  });

  const result = await callSonnet(systemPrompt, userMessage, {
    maxTokens: 8192,
    temperature: 0.4,
  });

  const draft = result.content.trim();
  if (draft.length < 100) {
    throw new Error("Refresh draft generation produced insufficient content");
  }

  return draft;
}
