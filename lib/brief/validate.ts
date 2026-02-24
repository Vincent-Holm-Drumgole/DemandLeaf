import type { BriefData, OutlineSection, SearchIntent, BuyerStage, SerpResult } from "@/types";

const VALID_INTENTS: ReadonlySet<SearchIntent> = new Set([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);

const VALID_STAGES: ReadonlySet<BuyerStage> = new Set([
  "awareness",
  "consideration",
  "decision",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isSerpResultArray(value: unknown): value is SerpResult[] {
  return (
    Array.isArray(value) &&
    value.every((item) =>
      isObject(item) &&
      typeof item.position === "number" &&
      typeof item.title === "string" &&
      typeof item.url === "string" &&
      typeof item.snippet === "string",
    )
  );
}

function isOutlineSectionArray(value: unknown): value is OutlineSection[] {
  return (
    Array.isArray(value) &&
    value.every((item) =>
      isObject(item) &&
      typeof item.heading === "string" &&
      (item.level === 2 || item.level === 3) &&
      (item.subheadings === undefined || isStringArray(item.subheadings)),
    )
  );
}

export function isBriefData(value: unknown): value is BriefData {
  if (!isObject(value)) return false;

  return (
    typeof value.targetKeyword === "string" &&
    typeof value.searchIntent === "string" &&
    VALID_INTENTS.has(value.searchIntent as SearchIntent) &&
    typeof value.buyerStage === "string" &&
    VALID_STAGES.has(value.buyerStage as BuyerStage) &&
    typeof value.keywordDifficulty === "number" &&
    typeof value.searchVolume === "number" &&
    typeof value.cpc === "number" &&
    typeof value.opportunityScore === "number" &&
    isSerpResultArray(value.serpAnalysis) &&
    typeof value.contentGap === "string" &&
    typeof value.uniqueAngle === "string" &&
    typeof value.archetypeRecommendation === "string" &&
    isOutlineSectionArray(value.outline) &&
    isStringArray(value.hookOptions) &&
    isStringArray(value.kbContext) &&
    isStringArray(value.internalLinkOpportunities) &&
    typeof value.estimatedWordCount === "number" &&
    typeof value.citationNeeds === "string" &&
    typeof value.successCriteria === "string" &&
    (value.cannibalizationNote === undefined || typeof value.cannibalizationNote === "string")
  );
}
