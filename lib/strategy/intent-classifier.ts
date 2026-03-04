import { callAI } from "@/lib/ai/client";
import type { SearchIntent } from "@/types";

const BATCH_SIZE = 50;

const VALID_INTENTS = new Set<SearchIntent>([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);

/**
 * Classifies the search intent of a list of keywords using Haiku.
 * Processes in batches of 50 to keep prompt size reasonable.
 * Returns a Map from keyword (lowercase) to SearchIntent.
 */
export async function classifyIntents(keywords: string[]): Promise<Map<string, SearchIntent>> {
  const result = new Map<string, SearchIntent>();
  const batches: string[][] = [];

  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    batches.push(keywords.slice(i, i + BATCH_SIZE));
  }

  await Promise.allSettled(
    batches.map(async (batch) => {
      const userMessage = `Classify the search intent of each keyword. Return a JSON array of objects with "keyword" and "intent" fields. Intent must be exactly one of: informational, commercial, transactional, navigational.

Keywords:
${batch.map((k, i) => `${i + 1}. ${k}`).join("\n")}

Respond with JSON only, no other text.`;

      let parsed: { keyword: string; intent: string }[] = [];
      try {
        const res = await callAI({
          model: "haiku",
          systemPrompt:
            "You are an SEO expert. Classify keyword search intent. Always respond with valid JSON array only.",
          userMessage,
          maxTokens: 2048,
        });
        const text = res.content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
        parsed = JSON.parse(text);
      } catch (err) {
        console.warn("[classifyIntents] batch failed, skipping:", err);
        return;
      }

      for (const item of parsed) {
        if (
          typeof item.keyword === "string" &&
          typeof item.intent === "string" &&
          VALID_INTENTS.has(item.intent as SearchIntent)
        ) {
          result.set(item.keyword.toLowerCase().trim(), item.intent as SearchIntent);
        }
      }
    })
  );

  return result;
}
