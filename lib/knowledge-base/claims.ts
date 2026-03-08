import type { KBClaimConfidence } from "@/types";
import { splitSentences } from "@/lib/text-utils";

const OBSERVED_PATTERNS = [
  /\bin our experience\b/i,
  /\bwe'?ve seen\b/i,
  /\bacross (?:multiple )?(?:implementations|engagements|teams|accounts)\b/i,
];

const DIRECTIONAL_PATTERNS = [
  /\btypically\b/i,
  /\boften\b/i,
  /\busually\b/i,
  /\bcan\b/i,
  /\bmay\b/i,
  /\btends to\b/i,
];

const VERIFIED_PATTERNS = [
  /\baccording to\b/i,
  /\breport\b/i,
  /\bstudy\b/i,
  /\bbenchmark\b/i,
  /\banalysis\b/i,
];

export interface DraftKnowledgeBaseClaim {
  statement: string;
  sourceName: string;
  sourceUrl?: string;
  confidence: KBClaimConfidence;
  lastCheckedAt: number;
  notes?: string;
}

export function extractCandidateClaimStatements(content: string): string[] {
  return splitSentences(content)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 25)
    .filter((sentence) => /\d/.test(sentence) || /%|\baccording to\b|\bin our experience\b|\btypically\b/i.test(sentence))
    .filter((sentence, index, all) => all.findIndex((value) => value === sentence) === index);
}

export function inferClaimConfidence(statement: string): KBClaimConfidence {
  if (VERIFIED_PATTERNS.some((pattern) => pattern.test(statement))) {
    return "verified";
  }
  if (OBSERVED_PATTERNS.some((pattern) => pattern.test(statement))) {
    return "observed";
  }
  return DIRECTIONAL_PATTERNS.some((pattern) => pattern.test(statement))
    ? "directional"
    : "directional";
}

export function draftKnowledgeBaseClaims(
  content: string,
  now = Date.now(),
): DraftKnowledgeBaseClaim[] {
  return extractCandidateClaimStatements(content).map((statement) => ({
    statement,
    sourceName: inferClaimConfidence(statement) === "observed"
      ? "Company experience"
      : "Source required",
    confidence: inferClaimConfidence(statement),
    lastCheckedAt: now,
  }));
}

export function expectedConfidenceLanguage(confidence: KBClaimConfidence): string[] {
  switch (confidence) {
    case "verified":
      return ["according to", "reported by", "benchmark", "study", "analysis"];
    case "observed":
      return ["in our experience", "we've seen", "across implementations", "we see"];
    case "directional":
      return ["typically", "often", "usually", "can", "may", "tends to"];
    default:
      return [];
  }
}

export function sentenceMatchesConfidenceLanguage(
  sentence: string,
  confidence: KBClaimConfidence,
  sourceName?: string,
): boolean {
  const lower = sentence.toLowerCase();
  if (confidence === "verified") {
    if (sourceName && lower.includes(sourceName.toLowerCase())) {
      return true;
    }
    return expectedConfidenceLanguage(confidence).some((token) => lower.includes(token));
  }
  return expectedConfidenceLanguage(confidence).some((token) => lower.includes(token));
}
