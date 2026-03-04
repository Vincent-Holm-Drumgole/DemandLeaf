import type { RefreshBriefData, SerpResult } from "@/types";
import { sanitizeXmlContent, sanitizePromptInput, sanitizeSingleLine } from "./sanitize";

export function buildRefreshBriefPrompt(input: {
  keyword: string;
  diagnosisCause: string;
  diagnosisNotes: string;
  currentPosition: number | null;
  blogTitle: string;
  blogAgeDays: number;
  wordCount: number;
  serpResults: SerpResult[];
  kbContextTitles: string[];
  currentOutline: string;
  businessOutcomes: string;
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `You are a senior SEO content strategist specializing in content refreshes.
Your job is to analyze an underperforming blog post and produce a detailed refresh brief.

Return a JSON object with this exact structure:
{
  "targetKeyword": string,
  "diagnosisCause": string,
  "diagnosisNotes": string,
  "currentPosition": number | null,
  "targetPosition": number,
  "sectionsToUpdate": [{ "heading": string, "instruction": string }],
  "newSectionsToAdd": [{ "heading": string, "rationale": string }],
  "sectionsToRemove": string[],
  "statisticsToRefresh": string[],
  "internalLinksToAdd": string[],
  "externalSourcesNeeded": string[],
  "estimatedReworkPercent": number,
  "successCriteria": string
}

Be specific and actionable. Each instruction should tell the writer exactly what to change.
Return ONLY the JSON object, nothing else.`;

  const serpStr = input.serpResults
    .slice(0, 5)
    .map(
      (s) =>
        `${s.position}. ${sanitizeSingleLine(s.title)} — ${sanitizeSingleLine(s.snippet).slice(0, 120)}`
    )
    .join("\n");

  const userMessage = `TARGET KEYWORD: ${sanitizeSingleLine(input.keyword)}
DIAGNOSIS: ${sanitizeSingleLine(input.diagnosisCause)} — ${sanitizeSingleLine(input.diagnosisNotes)}
CURRENT POSITION: ${input.currentPosition ?? "Not ranking"}

BLOG INFO:
Title: ${sanitizeSingleLine(input.blogTitle)}
Age: ${input.blogAgeDays} days
Word count: ${input.wordCount}

CURRENT OUTLINE:
${sanitizePromptInput(input.currentOutline)}

CURRENT SERP TOP 5:
${serpStr || "No SERP data available"}

BUSINESS OUTCOMES: ${sanitizeSingleLine(input.businessOutcomes)}

${input.kbContextTitles.length > 0 ? `AVAILABLE KB ENTRIES: ${input.kbContextTitles.join(", ")}` : ""}`;

  return { systemPrompt, userMessage };
}

export function buildRefreshDraftPrompt(input: {
  existingContent: string;
  refreshBrief: RefreshBriefData;
  voiceDescription: string;
  neverSayTerms: string[];
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `You are updating an existing blog post based on a refresh brief.

Rules:
- Preserve the overall structure and voice of the original post
- Only modify sections explicitly called out in the refresh brief
- Keep unchanged sections exactly as they are
- The word count should stay within 20% of the original
- Do NOT add placeholder content or "[insert here]" markers
${input.neverSayTerms.length > 0 ? `- NEVER use these terms: ${input.neverSayTerms.join(", ")}` : ""}

VOICE: ${sanitizeSingleLine(input.voiceDescription)}

Return the complete updated markdown. Nothing else.`;

  const briefStr = JSON.stringify(input.refreshBrief, null, 2);

  const userMessage = `REFRESH BRIEF:
<refresh_brief>
${sanitizeXmlContent(briefStr)}
</refresh_brief>

EXISTING CONTENT:
<existing_content>
${sanitizeXmlContent(input.existingContent)}
</existing_content>

Apply the refresh brief to the existing content and return the complete updated markdown.`;

  return { systemPrompt, userMessage };
}
