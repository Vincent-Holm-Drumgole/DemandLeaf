import { splitSentences, countWords, countTotalSyllables } from "@/lib/text-utils";

/**
 * Calculate Flesch Reading Ease score.
 * 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
 *
 * Score ranges:
 * 90-100: Very easy (5th grade)
 * 60-70: Standard (8th-9th grade) ← our target
 * 30-50: Difficult (college level)
 * 0-30: Very difficult (professional)
 */
export function calculateFleschReadingEase(text: string): number {
  const sentences = splitSentences(text);
  const wordCount = countWords(text);
  const syllableCount = countTotalSyllables(text);

  if (sentences.length === 0 || wordCount === 0) return 0;

  const avgSentenceLength = wordCount / sentences.length;
  const avgSyllablesPerWord = syllableCount / wordCount;

  const score =
    206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}
