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

// ── Phase 3: Strategy & Keyword Intelligence ──────────────────────────────────

export const searchIntentValidator = v.union(
  v.literal("informational"),
  v.literal("commercial"),
  v.literal("transactional"),
  v.literal("navigational")
);

export const buyerStageValidator = v.union(
  v.literal("awareness"),
  v.literal("consideration"),
  v.literal("decision")
);

export const keywordStatusValidator = v.union(
  v.literal("unassigned"),
  v.literal("briefed"),
  v.literal("written"),
  v.literal("published"),
  v.literal("ranking")
);

export const briefStatusValidator = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("written")
);

export const CALENDAR_STATUSES = ["scheduled", "in_progress", "completed", "skipped"] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const calendarStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("skipped")
);

export const strategyStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived")
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

// ── Brief data ────────────────────────────────────────────────────────────────

const outlineSectionValidator = v.object({
  heading: v.string(),
  level: v.union(v.literal(2), v.literal(3)),
  subheadings: v.optional(v.array(v.string())),
});

const serpResultValidator = v.object({
  position: v.number(),
  title: v.string(),
  url: v.string(),
  snippet: v.string(),
});

/**
 * Typed validator for BriefData (mirrors types/strategy.ts BriefData).
 * Used in contentBriefs.create and contentBriefs.approve to replace v.any().
 */
export const briefDataValidator = v.object({
  targetKeyword: v.string(),
  searchIntent: v.union(
    v.literal("informational"),
    v.literal("commercial"),
    v.literal("transactional"),
    v.literal("navigational"),
  ),
  buyerStage: v.union(
    v.literal("awareness"),
    v.literal("consideration"),
    v.literal("decision"),
  ),
  keywordDifficulty: v.number(),
  searchVolume: v.number(),
  cpc: v.number(),
  opportunityScore: v.number(),
  serpAnalysis: v.array(serpResultValidator),
  contentGap: v.string(),
  uniqueAngle: v.string(),
  archetypeRecommendation: v.string(),
  outline: v.array(outlineSectionValidator),
  hookOptions: v.array(v.string()),
  kbContext: v.array(v.string()),
  internalLinkOpportunities: v.array(v.string()),
  estimatedWordCount: v.number(),
  citationNeeds: v.string(),
  successCriteria: v.string(),
  cannibalizationNote: v.optional(v.string()),
});

/**
 * Partial BriefData validator for user-provided brief edits.
 * Each field is optional so PATCH-style updates can store only changed values.
 */
export const briefDataModificationsValidator = v.object({
  targetKeyword: v.optional(v.string()),
  searchIntent: v.optional(
    v.union(
      v.literal("informational"),
      v.literal("commercial"),
      v.literal("transactional"),
      v.literal("navigational"),
    ),
  ),
  buyerStage: v.optional(
    v.union(
      v.literal("awareness"),
      v.literal("consideration"),
      v.literal("decision"),
    ),
  ),
  keywordDifficulty: v.optional(v.number()),
  searchVolume: v.optional(v.number()),
  cpc: v.optional(v.number()),
  opportunityScore: v.optional(v.number()),
  serpAnalysis: v.optional(v.array(serpResultValidator)),
  contentGap: v.optional(v.string()),
  uniqueAngle: v.optional(v.string()),
  archetypeRecommendation: v.optional(v.string()),
  outline: v.optional(v.array(outlineSectionValidator)),
  hookOptions: v.optional(v.array(v.string())),
  kbContext: v.optional(v.array(v.string())),
  internalLinkOpportunities: v.optional(v.array(v.string())),
  estimatedWordCount: v.optional(v.number()),
  citationNeeds: v.optional(v.string()),
  successCriteria: v.optional(v.string()),
  cannibalizationNote: v.optional(v.union(v.string(), v.null())),
});

// ── SEO data cache ─────────────────────────────────────────────────────────────

const keywordMetricCacheValidator = v.object({
  keyword: v.string(),
  searchVolume: v.number(),
  keywordDifficulty: v.number(),
  cpc: v.number(),
});

/**
 * Union of the concrete payload shapes written to seoDataCache.data.
 * Keyed by prefix convention (keyword: / serp: / related: / domain:) — the
 * three shapes are structurally disjoint so no type-tag wrapper is needed.
 *   keyword: → { keyword, searchVolume, keywordDifficulty, cpc }
 *   serp:    → SerpResult[]
 *   related: / domain: → string[]
 */
const rankCheckCacheValidator = v.object({
  keyword: v.string(),
  position: v.union(v.number(), v.null()),
  url: v.union(v.string(), v.null()),
  checkedAt: v.number(),
});

export const seoDataCacheDataValidator = v.union(
  keywordMetricCacheValidator,
  v.array(serpResultValidator),
  v.array(v.string()),
  rankCheckCacheValidator,
);

// ── Phase 5: AEO/GEO & Publishing ───────────────────────────────────────────

export const wpAuthMethodValidator = v.literal("application_password");

export const wpConnectionStatusValidator = v.union(
  v.literal("connected"),
  v.literal("error"),
  v.literal("pending")
);

export const wpPluginValidator = v.union(
  v.literal("rankmath"),
  v.literal("yoast"),
  v.literal("none")
);

export const internalLinkStatusValidator = v.union(
  v.literal("suggested"),
  v.literal("accepted"),
  v.literal("rejected")
);

export const schemaTypeValidator = v.union(
  v.literal("Article"),
  v.literal("FAQPage"),
  v.literal("HowTo")
);

export const wpStatusValidator = v.union(
  v.literal("draft"),
  v.literal("publish"),
  v.literal("future"),
  v.literal("private")
);

export const socialUrlsValidator = v.object({
  twitter: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
});

// ── Phase 6: Post-Publish Intelligence ───────────────────────────────────────

export const decayAlertTypeValidator = v.union(
  v.literal("rank_drop"),
  v.literal("traffic_decline"),
  v.literal("ctr_decline"),
  v.literal("impressions_decline")
);

export const decayAlertSeverityValidator = v.union(
  v.literal("warning"),
  v.literal("critical")
);

export const decayAlertStatusValidator = v.union(
  v.literal("open"),
  v.literal("acknowledged"),
  v.literal("refreshing"),
  v.literal("resolved"),
  v.literal("escalated")
);

export const diagnosisCauseValidator = v.union(
  v.literal("content_freshness"),
  v.literal("serp_feature_loss"),
  v.literal("competitor_improvement"),
  v.literal("technical_issue"),
  v.literal("intent_mismatch"),
  v.literal("authority_gap")
);

export const refreshStatusValidator = v.union(
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("failed")
);

const refreshSectionUpdateValidator = v.object({
  heading: v.string(),
  instruction: v.string(),
});

const refreshSectionAddValidator = v.object({
  heading: v.string(),
  rationale: v.string(),
});

export const refreshBriefDataValidator = v.object({
  targetKeyword: v.string(),
  diagnosisCause: diagnosisCauseValidator,
  diagnosisNotes: v.string(),
  currentPosition: v.union(v.number(), v.null()),
  targetPosition: v.number(),
  sectionsToUpdate: v.array(refreshSectionUpdateValidator),
  newSectionsToAdd: v.array(refreshSectionAddValidator),
  sectionsToRemove: v.array(v.string()),
  statisticsToRefresh: v.array(v.string()),
  internalLinksToAdd: v.array(v.string()),
  externalSourcesNeeded: v.array(v.string()),
  estimatedReworkPercent: v.number(),
  successCriteria: v.string(),
});

export const googleConnectionStatusValidator = v.union(
  v.literal("connected"),
  v.literal("error"),
  v.literal("disconnected"),
  v.literal("pending_auth")
);

// ── Phase 7: Agentic Operations ──────────────────────────────────────────────

export const agentTypeValidator = v.union(
  v.literal("calendar"),
  v.literal("refresh"),
  v.literal("internal_links"),
  v.literal("competitive_response"),
  v.literal("strategy_drift"),
  v.literal("publishing")
);

export const agentActionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("executing"),
  v.literal("done"),
  v.literal("failed")
);

export const notificationTypeValidator = v.union(
  v.literal("agent_action_ready"),
  v.literal("agent_action_done"),
  v.literal("agent_action_failed")
);

export const auditActorTypeValidator = v.union(
  v.literal("agent"),
  v.literal("user")
);

export const publishingAgentStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused")
);

// ── Billing ──────────────────────────────────────────────────────────────────

export const planStatusValidator = v.union(
  v.literal("trial"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled")
);
