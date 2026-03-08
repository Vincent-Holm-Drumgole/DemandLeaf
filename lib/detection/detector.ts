import type { DetectionResult, DetectionRisk } from "@/types";
import { analyzeBurstiness } from "./burstiness";
import { scanBannedWords } from "./banned-words";
import { checkStructuralPatterns } from "./structural";
import { checkParagraphVariation } from "./paragraph-variation";
import { checkHeadingVariation } from "./heading-variation";
import { checkSentenceOpenerRepetition } from "./opener-repetition";
import { analyzeFillerParagraphs } from "./filler-paragraphs";
import { DETECTION_LOW_MAX, DETECTION_MEDIUM_MAX } from "@/lib/constants/detection";

/**
 * Run all 5 anti-detection algorithms on blog content.
 * Returns a risk score (0-100), risk level, and individual flags.
 *
 * All algorithms are pure code — no AI calls.
 */
export function detectAIContent(content: string): DetectionResult {
  // Algorithm 1: Burstiness analysis
  const burstiness = analyzeBurstiness(content);

  // Algorithm 2: Banned word/phrase check
  const banned = scanBannedWords(content);

  // Algorithm 3: Structural pattern detection
  const structuralFlags = checkStructuralPatterns(content);

  // Algorithm 4: Paragraph variation
  const paragraphFlags = checkParagraphVariation(content);

  // Algorithm 5: Heading variation
  const headingFlags = checkHeadingVariation(content);
  const openerFlags = checkSentenceOpenerRepetition(content);
  const filler = analyzeFillerParagraphs(content);

  // Combine all flags
  const allFlags = [
    ...burstiness.flags,
    ...banned.flags,
    ...structuralFlags,
    ...paragraphFlags,
    ...headingFlags,
    ...openerFlags,
    ...filler.flags,
  ];

  // Calculate total risk score
  const riskScore = Math.min(
    100,
    allFlags.reduce((sum, f) => sum + f.severity, 0)
  );

  // Determine risk level
  let riskLevel: DetectionRisk;
  if (riskScore <= DETECTION_LOW_MAX) {
    riskLevel = "low";
  } else if (riskScore <= DETECTION_MEDIUM_MAX) {
    riskLevel = "medium";
  } else {
    riskLevel = "high";
  }

  return {
    riskScore,
    riskLevel,
    flags: allFlags,
    burstinessStats: burstiness.stats,
  };
}
