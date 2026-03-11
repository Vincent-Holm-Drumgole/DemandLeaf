import { callAI } from "@/lib/ai/client";

const BATCH_SIZE = 50;
const RELEVANCE_THRESHOLD = 4;

/**
 * Filters discovered keywords by relevance to the strategy's business context.
 * Uses Haiku to score each keyword 1-10 for relevance, keeps those >= threshold.
 */
export async function filterByRelevance(
  keywords: string[],
  businessOutcomes: string,
  targetAudience?: string
): Promise<string[]> {
  if (keywords.length === 0) return [];

  const scores = new Map<string, number>();
  const batches: string[][] = [];

  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    batches.push(keywords.slice(i, i + BATCH_SIZE));
  }

  const context = [
    `Business context: ${businessOutcomes}`,
    targetAudience ? `Target audience: ${targetAudience}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await Promise.allSettled(
    batches.map(async (batch) => {
      const userMessage = `Score each keyword's relevance to this business on a scale of 1-10, where 1 is completely irrelevant and 10 is perfectly aligned.

${context}

Keywords:
${batch.map((k, i) => `${i + 1}. ${k}`).join("\n")}

Return a JSON array of objects with "keyword" and "score" fields. Respond with JSON only.`;

      try {
        const res = await callAI({
          model: "haiku",
          systemPrompt:
            "You are an SEO strategist. Score keyword relevance to a business context. Only return valid JSON array.",
          userMessage,
          maxTokens: 2048,
        });
        const text = res.content
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
        const parsed: { keyword: string; score: number }[] = JSON.parse(text);

        for (const item of parsed) {
          if (typeof item.keyword === "string" && typeof item.score === "number") {
            scores.set(item.keyword.toLowerCase().trim(), item.score);
          }
        }
      } catch (err) {
        console.warn("[filterByRelevance] batch failed, keeping all keywords in batch:", err);
        for (const kw of batch) {
          scores.set(kw.toLowerCase().trim(), RELEVANCE_THRESHOLD);
        }
      }
    })
  );

  return keywords.filter((kw) => {
    const score = scores.get(kw.toLowerCase().trim());
    return score === undefined || score >= RELEVANCE_THRESHOLD;
  });
}
