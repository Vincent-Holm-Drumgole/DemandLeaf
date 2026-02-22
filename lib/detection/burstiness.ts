import type { BurstinessStats, DetectionFlag } from "@/types";
import { splitSentences, countWords, stripMarkdown } from "@/lib/text-utils";
import {
  BURSTINESS_SD_MIN,
  BURSTINESS_SHORT_SENTENCE_MIN_PERCENT,
  BURSTINESS_LONG_SENTENCE_MIN_PERCENT,
  SHORT_SENTENCE_MAX_WORDS,
  LONG_SENTENCE_MIN_WORDS,
  MAX_CONSECUTIVE_SIMILAR_LENGTH,
  SENTENCE_SIMILARITY_DELTA,
  SEVERITY_LOW_BURSTINESS,
  SEVERITY_LOW_SHORT_SENTENCES,
  SEVERITY_LOW_LONG_SENTENCES,
} from "@/lib/constants/detection";

/**
 * Analyze sentence length variation (burstiness).
 * Human writing naturally has high variation; AI tends to be uniform.
 */
export function analyzeBurstiness(
  content: string
): { stats: BurstinessStats; flags: DetectionFlag[] } {
  const plainText = stripMarkdown(content);
  const sentences = splitSentences(plainText);
  const flags: DetectionFlag[] = [];

  if (sentences.length < 5) {
    flags.push({
      algorithm: "burstiness",
      severity: SEVERITY_LOW_BURSTINESS,
      detail: "Too few sentences to assess burstiness reliably. Add more varied sentence structures.",
    });

    return {
      stats: { mean: 0, standardDeviation: 0, percentShort: 0, percentLong: 0 },
      flags,
    };
  }

  // Calculate sentence lengths
  const lengths = sentences.map((s) => countWords(s));

  // Mean
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  // Standard deviation
  const squaredDiffs = lengths.map((l) => Math.pow(l - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length;
  const standardDeviation = Math.sqrt(variance);

  // Percent short and long
  const shortCount = lengths.filter((l) => l < SHORT_SENTENCE_MAX_WORDS).length;
  const longCount = lengths.filter((l) => l > LONG_SENTENCE_MIN_WORDS).length;
  const percentShort = shortCount / lengths.length;
  const percentLong = longCount / lengths.length;

  // Max consecutive sentences within a 5-word range.
  let similarRunLength = 1;
  for (let i = 1; i < lengths.length; i++) {
    if (Math.abs(lengths[i] - lengths[i - 1]) <= SENTENCE_SIMILARITY_DELTA) {
      similarRunLength++;
      if (similarRunLength > MAX_CONSECUTIVE_SIMILAR_LENGTH) {
        flags.push({
          algorithm: "burstiness",
          severity: SEVERITY_LOW_BURSTINESS,
          detail: `More than ${MAX_CONSECUTIVE_SIMILAR_LENGTH} consecutive sentences have near-identical length.`,
        });
        break;
      }
    } else {
      similarRunLength = 1;
    }
  }

  // Flag issues
  if (standardDeviation < BURSTINESS_SD_MIN) {
    flags.push({
      algorithm: "burstiness",
      severity: SEVERITY_LOW_BURSTINESS,
      detail: `Sentence length SD is ${standardDeviation.toFixed(1)} (need ${BURSTINESS_SD_MIN}+). Sentences are too uniform.`,
    });
  }

  if (percentShort < BURSTINESS_SHORT_SENTENCE_MIN_PERCENT) {
    flags.push({
      algorithm: "burstiness",
      severity: SEVERITY_LOW_SHORT_SENTENCES,
      detail: `Only ${(percentShort * 100).toFixed(0)}% short sentences (need ${BURSTINESS_SHORT_SENTENCE_MIN_PERCENT * 100}%+ under ${SHORT_SENTENCE_MAX_WORDS} words).`,
    });
  }

  if (percentLong < BURSTINESS_LONG_SENTENCE_MIN_PERCENT) {
    flags.push({
      algorithm: "burstiness",
      severity: SEVERITY_LOW_LONG_SENTENCES,
      detail: `Only ${(percentLong * 100).toFixed(0)}% long sentences (need ${BURSTINESS_LONG_SENTENCE_MIN_PERCENT * 100}%+ over ${LONG_SENTENCE_MIN_WORDS} words).`,
    });
  }

  return {
    stats: { mean, standardDeviation, percentShort, percentLong },
    flags,
  };
}
