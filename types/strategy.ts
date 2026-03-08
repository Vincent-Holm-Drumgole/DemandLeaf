import type { ContentTrack } from "./blog";

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational";
export type BuyerStage = "awareness" | "consideration" | "decision";
export type KeywordStatus = "unassigned" | "briefed" | "written" | "published" | "ranking";
export type BriefStatus = "draft" | "approved" | "rejected" | "written";
export type CalendarStatus = "scheduled" | "in_progress" | "completed" | "skipped";
export type StrategyStatus = "active" | "archived";

export interface SerpResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
}

export interface OutlineSection {
  heading: string;
  level: 2 | 3;
  subheadings?: string[];
}

export interface BriefData {
  targetKeyword: string;
  searchIntent: SearchIntent;
  buyerStage: BuyerStage;
  keywordDifficulty: number;
  searchVolume: number;
  cpc: number;
  opportunityScore: number;
  serpAnalysis: SerpResult[];
  contentGap: string;
  uniqueAngle: string;
  archetypeRecommendation: string;
  outline: OutlineSection[];
  hookOptions: string[];
  kbContext: string[];
  internalLinkOpportunities: string[];
  estimatedWordCount: number;
  citationNeeds: string;
  successCriteria: string;
  cannibalizationNote?: string;
}

export interface KeywordMetric {
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
}

export interface ClusterResult {
  name: string;
  pillarKeyword: string;
  keywords: string[];
}

export interface CannibalizationResult {
  hasCannibalization: boolean;
  overlappingBlogs: { id: string; title: string; similarity: number }[];
}

export interface CalendarItem {
  keywordId: string;
  keyword: string;
  archetype: string;
  contentTrack: ContentTrack;
  scheduledDate: number;
  priority: number;
}
