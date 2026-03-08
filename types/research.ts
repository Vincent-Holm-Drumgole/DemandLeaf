import type { ContentTrack } from "./blog";

export type ResearchSourceType = "rss" | "url";
export type ResearchSourceStatus = "active" | "paused" | "error";
export type ResearchBriefStatus = "pending_review" | "approved" | "archived";
export type ResearchBriefKind = "daily_brief" | "trend_report";

export interface ResearchSource {
  id: string;
  workspaceId: string;
  label: string;
  type: ResearchSourceType;
  url: string;
  keywords: string[];
  status: ResearchSourceStatus;
  lastCheckedAt?: number;
  lastSuccessAt?: number;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ResearchBrief {
  id: string;
  workspaceId: string;
  sourceId?: string;
  kind: ResearchBriefKind;
  status: ResearchBriefStatus;
  title: string;
  summary: string;
  whyItMatters: string;
  suggestedAngle: string;
  sourceUrls: string[];
  sourceNames: string[];
  keywords: string[];
  relevanceScore: number;
  contentTrack: ContentTrack;
  createdAt: number;
  updatedAt: number;
}

export interface CompetitorArticle {
  id: string;
  workspaceId: string;
  trackingId?: string;
  domain: string;
  url: string;
  title: string;
  summary: string;
  angle: string;
  keywords: string[];
  publishedAt?: number;
  scrapedAt: number;
}
