import type { Archetype, DetectionResult, GateResult, QualityGatesResult } from "@/types";
import { ARCHETYPES } from "@/lib/constants/archetypes";
import { SEO_PASS_THRESHOLD, FLESCH_MIN, FLESCH_MAX } from "@/lib/constants/seo";
import { DETECTION_MEDIUM_MAX } from "@/lib/constants/detection";

export interface QualityGateInput {
  seoScore: number;
  detectionResult: DetectionResult;
  readabilityScore: number;
  wordCount: number;
  archetype: Archetype;
  headingStructureValid: boolean;
  bannedWordsFound: number;
}

/**
 * Evaluate all 6 quality gates. All must pass for a blog to be publishable.
 * Returns per-gate results with auto-fix suggestions.
 */
export function evaluateQualityGates(input: QualityGateInput): QualityGatesResult {
  const minWords = ARCHETYPES[input.archetype].minWordCount;

  const gates: GateResult[] = [
    // Gate 1: SEO Score >= 80
    {
      gate: "SEO Score",
      passed: input.seoScore >= SEO_PASS_THRESHOLD,
      reason:
        input.seoScore < SEO_PASS_THRESHOLD
          ? `SEO score is ${input.seoScore}. Needs ${SEO_PASS_THRESHOLD}+.`
          : undefined,
      autoFixable: true,
      suggestion:
        input.seoScore < SEO_PASS_THRESHOLD
          ? "Revision pass can optimize keyword placement and meta tags"
          : undefined,
    },

    // Gate 2: Detection Risk = 'low' or 'medium' (high risk fails)
    {
      gate: "Detection Risk",
      passed: input.detectionResult.riskScore <= DETECTION_MEDIUM_MAX,
      reason:
        input.detectionResult.riskScore > DETECTION_MEDIUM_MAX
          ? `Detection risk is ${input.detectionResult.riskLevel} (score: ${input.detectionResult.riskScore}). Needs ≤${DETECTION_MEDIUM_MAX}.`
          : undefined,
      autoFixable: true,
      suggestion:
        input.detectionResult.riskScore > DETECTION_MEDIUM_MAX
          ? "Flagged sections will be rewritten to vary sentence structure and remove AI tells"
          : undefined,
    },

    // Gate 3: Readability in target range
    {
      gate: "Readability",
      passed:
        input.readabilityScore >= FLESCH_MIN &&
        input.readabilityScore <= FLESCH_MAX,
      reason:
        input.readabilityScore < FLESCH_MIN || input.readabilityScore > FLESCH_MAX
          ? `Flesch score is ${input.readabilityScore.toFixed(0)}. Target: ${FLESCH_MIN}-${FLESCH_MAX}.`
          : undefined,
      autoFixable: true,
      suggestion:
        input.readabilityScore < FLESCH_MIN
          ? "Simplify sentence structure and use shorter words"
          : input.readabilityScore > FLESCH_MAX
            ? "Add more detail and complex ideas to increase depth"
            : undefined,
    },

    // Gate 4: Word count meets archetype minimum
    {
      gate: "Word Count",
      passed: input.wordCount >= minWords,
      reason:
        input.wordCount < minWords
          ? `${input.wordCount} words. ${input.archetype} needs ${minWords}+.`
          : undefined,
      autoFixable: false,
      suggestion:
        input.wordCount < minWords
          ? `Content needs ${minWords - input.wordCount} more words`
          : undefined,
    },

    // Gate 5: Heading structure valid
    {
      gate: "Heading Structure",
      passed: input.headingStructureValid,
      reason: !input.headingStructureValid
        ? "Heading hierarchy is invalid"
        : undefined,
      autoFixable: true,
      suggestion: !input.headingStructureValid
        ? "Fix heading levels to follow H1 > H2 > H3 hierarchy"
        : undefined,
    },

    // Gate 6: No banned words remaining
    {
      gate: "No Banned Words",
      passed: input.bannedWordsFound === 0,
      reason:
        input.bannedWordsFound > 0
          ? `${input.bannedWordsFound} banned word(s) found`
          : undefined,
      autoFixable: true,
      suggestion:
        input.bannedWordsFound > 0
          ? "Revision pass will replace banned words with natural alternatives"
          : undefined,
    },
  ];

  const passedCount = gates.filter((g) => g.passed).length;
  const overallScore = Math.round((passedCount / gates.length) * 100);

  return {
    passed: gates.every((g) => g.passed),
    gates,
    overallScore,
  };
}
