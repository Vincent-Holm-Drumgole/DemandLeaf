/**
 * Shared Convex value validators for nested objects that appear in multiple
 * places (schema definitions and mutation args).
 *
 * Keeping them here prevents the same shape from being defined in two places
 * and serves as the authoritative runtime contract for these structures.
 */
import { v } from "convex/values";

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
});

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
