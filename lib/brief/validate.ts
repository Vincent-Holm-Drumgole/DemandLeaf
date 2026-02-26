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

export function isBriefDataPatch(value: unknown): value is Partial<BriefData> {
  if (!isObject(value)) return false;

  if (value.targetKeyword !== undefined && typeof value.targetKeyword !== "string") return false;
  if (value.searchIntent !== undefined && (!VALID_INTENTS.has(value.searchIntent as SearchIntent))) return false;
  if (value.buyerStage !== undefined && (!VALID_STAGES.has(value.buyerStage as BuyerStage))) return false;
  if (value.keywordDifficulty !== undefined && typeof value.keywordDifficulty !== "number") return false;
  if (value.searchVolume !== undefined && typeof value.searchVolume !== "number") return false;
  if (value.cpc !== undefined && typeof value.cpc !== "number") return false;
  if (value.opportunityScore !== undefined && typeof value.opportunityScore !== "number") return false;
  if (value.serpAnalysis !== undefined && !isSerpResultArray(value.serpAnalysis)) return false;
  if (value.contentGap !== undefined && typeof value.contentGap !== "string") return false;
  if (value.uniqueAngle !== undefined && typeof value.uniqueAngle !== "string") return false;
  if (value.archetypeRecommendation !== undefined && typeof value.archetypeRecommendation !== "string") return false;
  if (value.outline !== undefined && !isOutlineSectionArray(value.outline)) return false;
  if (value.hookOptions !== undefined && !isStringArray(value.hookOptions)) return false;
  if (value.kbContext !== undefined && !isStringArray(value.kbContext)) return false;
  if (value.internalLinkOpportunities !== undefined && !isStringArray(value.internalLinkOpportunities)) return false;
  if (value.estimatedWordCount !== undefined && typeof value.estimatedWordCount !== "number") return false;
  if (value.citationNeeds !== undefined && typeof value.citationNeeds !== "string") return false;
  if (value.successCriteria !== undefined && typeof value.successCriteria !== "string") return false;
  if (
    value.cannibalizationNote !== undefined &&
    value.cannibalizationNote !== null &&
    typeof value.cannibalizationNote !== "string"
  ) {
    return false;
  }

  return true;
}
