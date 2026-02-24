/**
 * Shared Convex value validators for nested objects that appear in multiple
 * places (schema definitions and mutation args).
 *
 * Keeping them here prevents the same shape from being defined in two places
 * and serves as the authoritative runtime contract for these structures.
 */
import { v } from "convex/values";
import { KB_ENTRY_TYPES } from "../types/knowledge-base";
import { EDIT_TYPES } from "../types/voice";

function literalUnion<const T extends readonly [string, string, ...string[]]>(values: T) {
  const [first, second, ...rest] = values;
  return v.union(v.literal(first), v.literal(second), ...rest.map((value) => v.literal(value)));
}

// ── Voice profile ─────────────────────────────────────────────────────────────

/** Numeric/tone attributes stored in voiceProfiles.voiceAttributes */
export const voiceAttributesValidator = v.object({
  formality: v.number(),
  humor: v.number(),
  jargonLevel: v.number(),
  sentenceComplexity: v.number(),
  toneAttributes: v.array(v.string()),
});

/** Preferred/avoided vocabulary stored in voiceProfiles.vocabularyPreferences */
export const vocabularyPreferencesValidator = v.object({
  preferred: v.array(v.string()),
  avoid: v.array(v.string()),
});

/**
 * Full VoiceProfile shape stored in anonymousSessions.voiceProfile.
 * Mirrors types/voice.ts VoiceProfile.
 *
 * DRIFT RISK — this validator intentionally duplicates fields from the two
 * sub-validators above, because the field names differ at the storage boundary:
 *
 *   voiceAttributesValidator      →  voiceProfileValidator
 *   ─────────────────────────────────────────────────────
 *   formality                        formality            (same)
 *   humor                            humor                (same)
 *   jargonLevel                      jargonLevel          (same)
 *   sentenceComplexity               sentenceComplexity   (same)
 *   toneAttributes                   toneAttributes       (same)
 *
 *   vocabularyPreferencesValidator →  voiceProfileValidator
 *   ─────────────────────────────────────────────────────
 *   preferred                        preferredVocabulary  (renamed)
 *   avoid                            avoidedVocabulary    (renamed)
 *
 * If voiceAttributesValidator or vocabularyPreferencesValidator change,
 * update this validator to match. Convex will reject mismatched inserts
 * at runtime, which provides a safety net.
 */
export const voiceProfileValidator = v.object({
  voiceDescription: v.string(),
  formality: v.number(),
  humor: v.number(),
  jargonLevel: v.number(),
  sentenceComplexity: v.number(),
  toneAttributes: v.array(v.string()),
  preferredVocabulary: v.array(v.string()),
  avoidedVocabulary: v.array(v.string()),
  writingExamples: v.array(v.string()),
  sourceQuality: v.string(),
  // Phase 2 optional fields
  thoughtLeadershipPositions: v.optional(v.array(v.string())),
  brandPhilosophy: v.optional(v.string()),
});

// ── Knowledge Base ─────────────────────────────────────────────────────────────

/** Valid entry types for knowledge base entries */
export const kbEntryTypeValidator = literalUnion(KB_ENTRY_TYPES);

// ── Edit Learning ─────────────────────────────────────────────────────────────

/** Edit type classification for blog edits */
export const editTypeValidator = literalUnion(EDIT_TYPES);

// ── Status enums ──────────────────────────────────────────────────────────────

export const embeddingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("ready"),
  v.literal("failed")
);

export const termTypeValidator = v.union(
  v.literal("word"),
  v.literal("phrase")
);

export const classificationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("classified"),
  v.literal("failed")
);

// ── Crawl data ────────────────────────────────────────────────────────────────

const crawledPageValidator = v.object({
  url: v.string(),
  type: v.string(),
  title: v.string(),
  content: v.string(),
  wordCount: v.number(),
});

/**
 * Crawl result stored in anonymousSessions.crawlData.
 * Set by POST /api/crawl after website analysis completes.
 */
export const crawlDataValidator = v.object({
  url: v.string(),
  companyName: v.string(),
  industry: v.string(),
  audience: v.string(),
  audienceExpertise: v.string(),
  pages: v.array(crawledPageValidator),
});

// ── Blog data ─────────────────────────────────────────────────────────────────

/**
 * Blog generation result stored in anonymousSessions.blogData.
 * Set by POST /api/generate after the pipeline completes.
 */
export const blogDataValidator = v.object({
  blogId: v.string(),
  content: v.string(),
  contentHtml: v.optional(v.string()),
  title: v.string(),
  slug: v.optional(v.string()),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  focusKeyword: v.optional(v.string()),
  archetype: v.string(),
  wordCount: v.optional(v.number()),
  seoScore: v.optional(v.number()),
  qualityScore: v.optional(v.number()),
  detectionRisk: v.optional(v.string()),
  detectionRiskScore: v.optional(v.number()),
  burstinessScore: v.optional(v.number()),
  readabilityScore: v.optional(v.number()),
  modelUsed: v.optional(v.string()),
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  generationCostCents: v.optional(v.number()),
  generationTimeMs: v.optional(v.number()),
  promptVersion: v.optional(v.string()),
});
