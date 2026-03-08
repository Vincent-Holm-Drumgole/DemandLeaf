import type {
  DetectionResult,
  FactCheckReport,
  QualityScoreBreakdown,
} from "@/types";
import { extractParagraphs, splitSentences, stripMarkdown } from "@/lib/text-utils";
import { ALL_BANNED_WORDS, BANNED_PHRASES } from "@/lib/constants/banned-words";

const PLATFORM_TERMS = [
  "salesforce",
  "pardot",
  "hubspot",
  "marketo",
  "eloqua",
  "google ads",
  "meta",
  "linkedin",
  "utm",
  "mql",
  "sql",
  "crm",
  "scoring",
  "attribution",
  "workflow",
  "sync",
];

const FRAMEWORK_PATTERNS: Array<{ category: QualityScoreBreakdown["uniqueInsight"]["category"]; pattern: RegExp; reason: string }> = [
  { category: "framework", pattern: /\bframework\b|\bmatrix\b|\bchecklist\b/i, reason: "Contains an original framework or decision device" },
  { category: "contrarian_take", pattern: /\bbut\b|\binstead\b|\bwrong\b|\bmyth\b/i, reason: "Makes a non-obvious or contrarian claim" },
  { category: "concrete_example", pattern: /\bfor example\b|\bscenario\b|\bfire drill\b|\bmonday morning\b/i, reason: "Contains a concrete practitioner scenario" },
];

export function computeCredibleQualityScore(input: {
  content: string;
  detectionResult: DetectionResult;
  factCheck: FactCheckReport;
  competitorAngles?: string[];
}): QualityScoreBreakdown {
  const plain = stripMarkdown(input.content);
  const lower = plain.toLowerCase();
  const paragraphs = extractParagraphs(input.content);
  const sentences = splitSentences(input.content);
  const numbersCount = (plain.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).length;
  const platformHits = PLATFORM_TERMS.filter((term) => lower.includes(term));
  const bannedHits = ALL_BANNED_WORDS.filter((word) => lower.includes(word.toLowerCase())).length
    + BANNED_PHRASES.filter((phrase) => lower.includes(phrase.toLowerCase())).length;

  const specificity = clampScore(numbersCount * 14 + platformHits.length * 8 + concreteScenarioCount(plain) * 10);
  const verifiedClaims = input.factCheck.claims.filter((claim) => claim.verificationStatus === "verified").length;
  const sourceIntegrity = input.factCheck.claims.length === 0
    ? 40
    : clampScore((verifiedClaims / input.factCheck.claims.length) * 100 - input.factCheck.unverifiedCount * 20 - input.factCheck.mismatchCount * 8);
  const originalityPenalty = (input.competitorAngles ?? [])
    .filter((angle) => angle.length > 0)
    .reduce((penalty, angle) => penalty + (lower.includes(angle.toLowerCase().slice(0, 80)) ? 12 : 0), 0);
  const originality = clampScore(uniqueAngleScore(plain) + Math.max(0, numbersCount - 1) * 8 - originalityPenalty);
  const practitionerDepth = clampScore(platformHits.length * 14 + workflowTermCount(plain) * 8);
  const brandVoiceAlignment = clampScore(
    100
      - input.detectionResult.riskScore
      - bannedHits * 8
      - Math.round(input.factCheck.mismatchCount * 10),
  );

  const uniqueInsight = detectUniqueInsight(plain);
  const weightedScore = Math.round(
    specificity * 0.25 +
      sourceIntegrity * 0.25 +
      originality * 0.2 +
      practitionerDepth * 0.15 +
      brandVoiceAlignment * 0.15,
  );

  return {
    specificity,
    sourceIntegrity,
    originality,
    practitionerDepth,
    brandVoiceAlignment,
    fillerRatio: paragraphs.length === 0 ? 0 : paragraphs.filter(isLikelyFillerParagraph).length / paragraphs.length,
    openerRepetitionCount: countRepeatedSentenceOpeners(sentences),
    uniqueInsight,
    weightedScore,
  };
}

function concreteScenarioCount(text: string): number {
  return (text.match(/\b(?:example|scenario|workflow|fire drill|audit|handoff|reporting cadence)\b/gi) ?? []).length;
}

function workflowTermCount(text: string): number {
  return (text.match(/\b(?:field mapping|lead routing|sync failure|attribution|scoring model|campaign member|automation rule|connector)\b/gi) ?? []).length;
}

function uniqueAngleScore(text: string): number {
  return FRAMEWORK_PATTERNS.reduce(
    (score, item) => score + (item.pattern.test(text) ? 25 : 0),
    10,
  );
}

function detectUniqueInsight(text: string): QualityScoreBreakdown["uniqueInsight"] {
  if (/\b\d+(?:\.\d+)?%?\b/.test(text) && /\baccording to\b|\bin our experience\b|\bbenchmark\b/i.test(text)) {
    return { passed: true, reason: "Contains a specific data point with context", category: "data_point" };
  }

  for (const candidate of FRAMEWORK_PATTERNS) {
    if (candidate.pattern.test(text)) {
      return { passed: true, reason: candidate.reason, category: candidate.category };
    }
  }

  return { passed: false, reason: "No differentiated data point, framework, contrarian take, or concrete scenario detected" };
}

function isLikelyFillerParagraph(paragraph: string): boolean {
  return !/\d/.test(paragraph)
    && !PLATFORM_TERMS.some((term) => paragraph.toLowerCase().includes(term))
    && !/\b(?:example|for instance|workflow|scenario|step|config)\b/i.test(paragraph);
}

function countRepeatedSentenceOpeners(sentences: string[]): number {
  let count = 0;
  let last = "";
  let streak = 0;
  for (const sentence of sentences) {
    const opener = sentence.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    if (!opener) continue;
    if (opener === last) {
      streak += 1;
    } else {
      last = opener;
      streak = 1;
    }
    if (streak >= 3) count += 1;
  }
  return count;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
