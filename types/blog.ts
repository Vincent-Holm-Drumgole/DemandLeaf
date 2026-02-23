import type { VoiceProfile } from "./voice";
import type { KBContextResult } from "./knowledge-base";

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

export interface GenerationInput {
  keyword: string;
  archetype: Archetype;
  voiceProfile: VoiceProfile;
  companyContext: string;
  industry: string;
  audience: string;
  kbContext?: KBContextResult;
  neverSayTerms?: string[];
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
  wordCount: number;
  scores: BlogScores;
  voiceMatchScore?: number;
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

export type PipelineStepStatus = "pending" | "running" | "complete" | "error";

export interface PipelineStep {
  name: string;
  status: PipelineStepStatus;
  durationMs?: number;
}
