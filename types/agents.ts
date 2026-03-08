import type { RefreshBriefData } from "./performance";

export type AgentType =
  | "calendar"
  | "refresh"
  | "internal_links"
  | "competitive_response"
  | "strategy_drift"
  | "publishing";
export type AgentActionStatus = "pending" | "approved" | "rejected" | "executing" | "done" | "failed";
export type NotificationType =
  | "agent_action_ready"
  | "agent_action_done"
  | "agent_action_failed"
  | "kb_review_due"
  | "research_brief_ready"
  | "trend_report_ready";

export interface AgentAction {
  _id: string;
  workspaceId: string;
  agentType: AgentType;
  status: AgentActionStatus;
  payload:
    | CalendarAgentPayload
    | RefreshAgentPayload
    | InternalLinksAgentPayload
    | CompetitiveResponsePayload
    | StrategyDriftPayload
    | PublishingAgentPayload;
  reasoning: string;
  suggestedAt: number;
  decidedAt?: number;
  executedAt?: number;
  failureReason?: string;
  userNote?: string;
}

export interface CalendarAgentPayload {
  strategyId: string;
  proposedChanges: Array<{
    calendarId: string;
    keyword: string;
    currentScheduledDate: number;
    proposedScheduledDate: number;
    currentPriority: number;
    proposedPriority: number;
    rationale: string;
  }>;
  digest: string;
}

export interface RefreshAgentPayload {
  alerts: Array<{
    alertId: string | null;
    blogId: string;
    blogTitle: string;
    alertType: string;
    severity: string;
    briefData: RefreshBriefData;
    estimatedReworkPercent: number;
  }>;
}

export interface InternalLinksAgentPayload {
  blogId: string;
  blogTitle: string;
  suggestions: Array<{
    internalLinkId: string;
    targetBlogTitle: string;
    anchorText: string;
    similarity: number;
    insertionNote: string;
  }>;
}

// Phase 8 payloads

export interface CompetitiveResponsePayload {
  strategyId: string;
  threats: Array<{
    keyword: string;
    competitorDomain: string;
    competitorUrl: string;
    competitorPosition: number;
    threatType: "gap" | "update_needed";
    action: "create_brief" | "update_brief";
    targetBriefId?: string;
    rationale: string;
  }>;
  digest: string;
}

export interface StrategyDriftPayload {
  strategyId: string;
  coverageRate: number;
  rankingHealthRate: number;
  highOpportunityGaps: string[];
  archetypeImbalances: string[];
  pivotRecommendations: Array<{
    type: "keyword" | "archetype" | "topic";
    recommendation: string;
    rationale: string;
  }>;
  digest: string;
}

export interface PublishingAgentPayload {
  calendarItemId: string;
  briefId: string;
  keyword: string;
  archetype: string;
  strategyId: string;
  wpConnectionId?: string;
}

export type TrustTier = "learning" | "established" | "trusted";

export interface TrustScore {
  totalDecisions: number;
  approvalCount: number;
  rejectionCount: number;
  approvalRate: number;
  trustTier: TrustTier;
}

export interface Notification {
  _id: string;
  workspaceId: string;
  type: NotificationType;
  agentType?: AgentType;
  agentActionId?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}
