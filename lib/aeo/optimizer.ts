import { callSonnet } from "@/lib/ai/client";
import type { AeoScore } from "@/types";

export const AEO_OPTIMIZER_THRESHOLD = 60;

interface AeoOptimizationResult {
  content: string;
  changed: boolean;
  costCents: number;
  durationMs: number;
}

/**
 * Conditional Sonnet pass: only fires when AEO score < threshold.
 * Adds FAQ section, formats extractable passages, surfaces existing citations.
 * Does NOT invent statistics — only reorganizes existing content.
 */
export async function optimizeForAEO(
  content: string,
  aeoScore: AeoScore,
  failedChecks: string[]
): Promise<AeoOptimizationResult> {
  const system = `You are an AEO (Answer Engine Optimization) specialist.
Your job is to reformat content so it can be extracted and cited by AI search engines
(ChatGPT, Perplexity, Google AI Overviews) without changing the factual substance.

Rules:
- If missing, add an FAQ section at the end with 3-5 Q&A pairs derived from the existing headings and content.
- Rephrase at least 2 existing headings as direct questions if they aren't already.
- Format one paragraph near the top of the article as a concise 50-60 word direct answer to the main topic.
- Do NOT invent statistics or data — only highlight and reformat ones that already exist in the content.
- Do NOT add external links or fabricate sources.
- Preserve the existing tone, voice, and style exactly.
- The word count should stay within 15% of the original.
- Return ONLY the full updated markdown. No commentary, no explanations.`;

  const user = `CURRENT AEO SCORE: ${aeoScore.score}/100
FAILED CHECKS: ${failedChecks.join(", ")}

CONTENT TO OPTIMIZE:
${content}`;

  const start = Date.now();
  const result = await callSonnet(system, user, {
    maxTokens: 8192,
    temperature: 0.3,
  });
  const durationMs = Date.now() - start;
  const updated = result.content.trim();
  const changed = updated !== content && updated.length > 100;

  return {
    content: changed ? updated : content,
    changed,
    costCents: result.costCents,
    durationMs,
  };
}
