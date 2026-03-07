export const SCORECARD_DIMENSIONS = [
  "brandVoice",
  "structure",
  "depthAccuracy",
  "readability",
  "onTopicFocus",
] as const;

export type ScorecardDimension = (typeof SCORECARD_DIMENSIONS)[number];

export const SCORECARD_DIMENSION_LABELS: Record<ScorecardDimension, string> = {
  brandVoice: "Brand Voice",
  structure: "Structure",
  depthAccuracy: "Depth & Accuracy",
  readability: "Readability",
  onTopicFocus: "On-Topic Focus",
};

export const SCORECARD_DIMENSION_WEIGHTS: Record<ScorecardDimension, number> = {
  brandVoice: 0.3,
  structure: 0.25,
  depthAccuracy: 0.2,
  readability: 0.15,
  onTopicFocus: 0.1,
};

export const SCORECARD_PRESET_TAGS: Record<ScorecardDimension, readonly string[]> = {
  brandVoice: [
    "Too formal/stiff",
    "Wrong tone",
    "Missing brand terminology",
    "Sounds generic/AI-like",
    "Inconsistent voice",
  ],
  structure: [
    "Poor heading hierarchy",
    "Missing intro hook",
    "Weak transitions",
    "No conclusion/CTA",
    "Sections unbalanced",
  ],
  depthAccuracy: [
    "Lacks examples",
    "Unsupported claims",
    "Surface-level",
    "Missing key subtopic",
    "Outdated info",
  ],
  readability: [
    "Complex sentences",
    "Unexplained jargon",
    "Wall of text",
    "Passive voice overuse",
    "Repetitive phrasing",
  ],
  onTopicFocus: [
    "Drifts from keyword",
    "Irrelevant tangent",
    "Wrong search intent",
    "Wrong audience level",
    "Keyword stuffing",
  ],
};

export const MAX_COACHING_NOTE_LENGTH = 300;
export const MIN_SCORED_OUTPUTS_FOR_FEW_SHOTS = 5;
export const FEW_SHOT_COMPOSITE_THRESHOLD = 8;
export const FEW_SHOT_LIMIT = 3;
export const SUPPRESSED_TAG_THRESHOLD = 3;

export function isScorecardDimension(value: string): value is ScorecardDimension {
  return SCORECARD_DIMENSIONS.includes(value as ScorecardDimension);
}

export function getPresetReasonTags(dimension: ScorecardDimension): readonly string[] {
  return SCORECARD_PRESET_TAGS[dimension];
}

export function normalizeReasonTag(
  dimension: ScorecardDimension,
  rawTag: string,
): string | null {
  const trimmed = rawTag.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const presetMatch = SCORECARD_PRESET_TAGS[dimension].find(
    (presetTag) => presetTag.toLowerCase() === trimmed.toLowerCase(),
  );
  return presetMatch ?? trimmed;
}

export function isPresetReasonTag(dimension: ScorecardDimension, tag: string): boolean {
  return SCORECARD_PRESET_TAGS[dimension].some(
    (presetTag) => presetTag.toLowerCase() === tag.trim().toLowerCase(),
  );
}
