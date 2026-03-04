export type DecayAlertType = "rank_drop" | "traffic_decline" | "ctr_decline" | "impressions_decline";
export type DecayAlertSeverity = "warning" | "critical";
export type DecayAlertStatus = "open" | "acknowledged" | "refreshing" | "resolved" | "escalated";
export type DiagnosisCause =
  | "content_freshness"
  | "serp_feature_loss"
  | "competitor_improvement"
  | "technical_issue"
  | "intent_mismatch"
  | "authority_gap";
export type RefreshStatus = "pending" | "in_progress" | "completed" | "failed";
export type GoogleConnectionStatus = "connected" | "error" | "disconnected" | "pending_auth";

export interface RankSnapshot {
  blogId: string;
  keyword: string;
  position: number | null;
  url: string | null;
  searchVolume: number | null;
  checkedAt: number;
}

export interface RankCheckResult {
  keyword: string;
  position: number | null;
  url: string | null;
  checkedAt: number;
}

export interface PerformanceMetric {
  blogId: string;
  sessions: number | null;
  pageviews: number | null;
  avgEngagementTimeSec: number | null;
  bounceRate: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  avgPosition: number | null;
  periodStart: number;
  periodEnd: number;
}

export interface DecayAlert {
  _id: string;
  blogId: string;
  alertType: DecayAlertType;
  severity: DecayAlertSeverity;
  triggeredAt: number;
  status: DecayAlertStatus;
  baselineValue: number;
  currentValue: number;
  deltaPercent: number;
  diagnosisCause?: DiagnosisCause;
  diagnosisNotes?: string;
}

export interface DecaySignal {
  blogId: string;
  keyword: string;
  alertType: DecayAlertType;
  severity: DecayAlertSeverity;
  baselineValue: number;
  currentValue: number;
  deltaPercent: number;
}

export interface DiagnosisResult {
  cause: DiagnosisCause;
  confidence: "high" | "medium" | "low";
  notes: string;
  topActions: string[];
}

export interface RefreshBriefData {
  targetKeyword: string;
  diagnosisCause: DiagnosisCause;
  diagnosisNotes: string;
  currentPosition: number | null;
  targetPosition: number;
  sectionsToUpdate: Array<{ heading: string; instruction: string }>;
  newSectionsToAdd: Array<{ heading: string; rationale: string }>;
  sectionsToRemove: string[];
  statisticsToRefresh: string[];
  internalLinksToAdd: string[];
  externalSourcesNeeded: string[];
  estimatedReworkPercent: number;
  successCriteria: string;
}

export interface ROIData {
  available: boolean;
  reason?: "ga4_not_connected" | "ga4_error";
  totalClicks: number | null;
  totalSessions: number | null;
  estimatedTrafficValue: number | null;
  totalGenerationCostCents: number;
  postsRanking: number;
  avgPosition: number | null;
  positionChangeLastMonth: number | null;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

export interface GA4PostMetrics {
  blogUrl: string;
  sessions: number;
  pageviews: number;
  avgEngagementTimeSec: number;
  bounceRate: number;
  periodStart: number;
  periodEnd: number;
}

export interface GSCPostMetrics {
  blogUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  periodStart: number;
  periodEnd: number;
}
