import type { VoiceProfile } from "./voice";
import type { KBContextResult } from "./knowledge-base";

export type ContentTrack = "evergreen" | "research" | "thought_leadership";
export type Archetype =
  | "how_to"
  | "listicle"
  | "definitive_guide"
  | "thought_leadership"
  | "comparison"
  | "data_study"
  | "case_study"
  | "news_commentary";

export type BlogStatus = "draft" | "approved" | "exported" | "published";

export type DetectionRisk = "low" | "medium" | "high";

export interface BriefHint {
  /** Pre-approved outline string (H2/H3 headings) derived from a Phase 3 content brief. */
  outline: string;
  /** Hook options from the approved brief; first item is preferred. */
  hookOptions: string[];
  /** Phase 5: internal link topic hints from the brief. */
  internalLinkOpportunities?: string[];
  /** Phase 5: citation needs description from the brief. */
  citationNeeds?: string;
}

export interface GenerationInput {
  keyword: string;
  archetype: Archetype;
  contentTrack?: ContentTrack;
  voiceProfile: VoiceProfile;
  companyContext: string;
  masterContext?: string;
  industry: string;
  audience: string;
  kbContext?: KBContextResult;
  neverSayTerms?: string[];
  trainingContext?: string;
  /** When provided, skips Step 1 brief generation and uses the pre-approved brief data. */
  briefHint?: BriefHint;
}

export interface GenerationResult {
  blogId: string;
  content: string;
  contentHtml: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  archetype: Archetype;
  contentTrack: ContentTrack;
  wordCount: number;
  scores: BlogScores;
  qualityBreakdown?: QualityScoreBreakdown;
  factCheckReport?: FactCheckReport;
  voiceMatchScore?: number;
  aeoScore?: number;
  generationTimeMs: number;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  aiCalls: AICallBreakdown[];
  modelUsed: string;
  promptVersion: string;
}

export interface AICallBreakdown {
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  durationMs: number;
}

export interface BlogScores {
  seoScore: number;
  qualityScore: number;
  detectionRisk: DetectionRisk;
  detectionRiskScore: number;
  burstinessScore: number;
  readabilityScore: number;
}

export interface QualityScoreBreakdown {
  specificity: number;
  sourceIntegrity: number;
  originality: number;
  practitionerDepth: number;
  brandVoiceAlignment: number;
  fillerRatio: number;
  openerRepetitionCount: number;
  uniqueInsight: {
    passed: boolean;
    reason: string;
    category?: "data_point" | "contrarian_take" | "concrete_example" | "framework";
  };
  weightedScore: number;
}

export interface FactCheckClaim {
  id: string;
  text: string;
  sentence: string;
  sourceType: "knowledge_base" | "research_source" | "inline_citation" | "unverified";
  confidence?: "verified" | "observed" | "directional";
  sourceName?: string;
  sourceUrl?: string;
  knowledgeBaseEntryId?: string;
  knowledgeBaseClaimId?: string;
  languageMatch: boolean;
  verificationStatus: "verified" | "warning" | "unverified";
  notes?: string;
}

export interface FactCheckReport {
  claims: FactCheckClaim[];
  reviewedAt?: number;
  reviewedBy?: string;
  unverifiedCount: number;
  mismatchCount: number;
}

export interface PublicationChecklist {
  minQualityScore: number;
  qualityScorePassed: boolean;
  zeroUnverifiedClaims: boolean;
  factCheckReviewed: boolean;
  bannedTermsPassed: boolean;
  specificExamplesPassed: boolean;
  uniqueInsightPassed: boolean;
  humanApproved: boolean;
}

export interface PublicationCheckResult {
  blockers: string[];
  checklist: PublicationChecklist;
  qualityBreakdown: QualityScoreBreakdown;
  factCheck: FactCheckReport;
  killSwitchTriggered: boolean;
  canPublish: boolean;
  updatedAt: number;
}

export type PipelineStepStatus = "pending" | "running" | "complete" | "error";

export interface PipelineStep {
  name: string;
  status: PipelineStepStatus;
  durationMs?: number;
}
