import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireWorkspaceAccess, requireCronAccess } from "./helpers";
import {
  ERR_AGENT_ACTION_NOT_FOUND,
  ERR_AGENT_ACTION_NOT_APPROVED,
  ERR_AGENT_ACTION_NOT_PENDING,
  ERR_INVALID_AGENT_PAYLOAD,
  ERR_PUBLISHING_AGENT_NOT_ACTIVE,
  ERR_TRUST_GATE_NOT_MET,
} from "./errors";
import {
  agentTypeValidator,
  agentActionStatusValidator,
} from "./validators";

const MAX_ACTIONS_PER_WORKSPACE = 100;
const MAX_APPROVED_ACTIONS_PER_RUN = 50;
import {
  MAX_TRUST_AUDIT_ENTRIES,
  TRUSTED_MIN_DECISIONS,
  TRUSTED_MIN_RATE,
} from "./agentTrust";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRefreshBriefData(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;

  const sectionsToUpdate = value.sectionsToUpdate;
  const newSectionsToAdd = value.newSectionsToAdd;
  const sectionsToRemove = value.sectionsToRemove;
  const statisticsToRefresh = value.statisticsToRefresh;
  const internalLinksToAdd = value.internalLinksToAdd;
  const externalSourcesNeeded = value.externalSourcesNeeded;

  return (
    typeof value.targetKeyword === "string" &&
    typeof value.diagnosisCause === "string" &&
    typeof value.diagnosisNotes === "string" &&
    (value.currentPosition === null || isFiniteNumber(value.currentPosition)) &&
    isFiniteNumber(value.targetPosition) &&
    Array.isArray(sectionsToUpdate) &&
    sectionsToUpdate.every(
      (section) =>
        isObjectRecord(section) &&
        typeof section.heading === "string" &&
        typeof section.instruction === "string",
    ) &&
    Array.isArray(newSectionsToAdd) &&
    newSectionsToAdd.every(
      (section) =>
        isObjectRecord(section) &&
        typeof section.heading === "string" &&
        typeof section.rationale === "string",
    ) &&
    Array.isArray(sectionsToRemove) &&
    sectionsToRemove.every((s) => typeof s === "string") &&
    Array.isArray(statisticsToRefresh) &&
    statisticsToRefresh.every((s) => typeof s === "string") &&
    Array.isArray(internalLinksToAdd) &&
    internalLinksToAdd.every((s) => typeof s === "string") &&
    Array.isArray(externalSourcesNeeded) &&
    externalSourcesNeeded.every((s) => typeof s === "string") &&
    isFiniteNumber(value.estimatedReworkPercent) &&
    typeof value.successCriteria === "string"
  );
}

function isCalendarPayload(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  if (typeof value.strategyId !== "string") return false;
  if (typeof value.digest !== "string") return false;
  if (!Array.isArray(value.proposedChanges)) return false;
  if (value.proposedChanges.length === 0) return false;

  return value.proposedChanges.every(
    (change) =>
      isObjectRecord(change) &&
      typeof change.calendarId === "string" &&
      typeof change.keyword === "string" &&
      isFiniteNumber(change.currentScheduledDate) &&
      isFiniteNumber(change.proposedScheduledDate) &&
      isFiniteNumber(change.currentPriority) &&
      isFiniteNumber(change.proposedPriority) &&
      typeof change.rationale === "string",
  );
}

function isRefreshPayload(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  if (!Array.isArray(value.alerts)) return false;
  if (value.alerts.length === 0) return false;

  return value.alerts.every(
    (alert) =>
      isObjectRecord(alert) &&
      typeof alert.alertId === "string" &&
      typeof alert.blogId === "string" &&
      typeof alert.blogTitle === "string" &&
      typeof alert.alertType === "string" &&
      typeof alert.severity === "string" &&
      isFiniteNumber(alert.estimatedReworkPercent) &&
      isRefreshBriefData(alert.briefData),
  );
}

function isInternalLinksPayload(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  if (typeof value.blogId !== "string") return false;
  if (typeof value.blogTitle !== "string") return false;
  if (!Array.isArray(value.suggestions)) return false;
  if (value.suggestions.length === 0) return false;

  return value.suggestions.every(
    (suggestion) =>
      isObjectRecord(suggestion) &&
      typeof suggestion.internalLinkId === "string" &&
      typeof suggestion.targetBlogTitle === "string" &&
      typeof suggestion.anchorText === "string" &&
      isFiniteNumber(suggestion.similarity) &&
      typeof suggestion.insertionNote === "string",
  );
}

function isCompetitiveResponsePayload(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  if (typeof value.strategyId !== "string") return false;
  if (typeof value.digest !== "string") return false;
  if (!Array.isArray(value.threats)) return false;
  if (value.threats.length === 0) return false;

  return value.threats.every(
    (threat) =>
      isObjectRecord(threat) &&
      typeof threat.keyword === "string" &&
      typeof threat.competitorDomain === "string" &&
      typeof threat.competitorUrl === "string" &&
      isFiniteNumber(threat.competitorPosition) &&
      (threat.threatType === "gap" || threat.threatType === "update_needed") &&
      (threat.action === "create_brief" || threat.action === "update_brief") &&
      (threat.targetBriefId === undefined || typeof threat.targetBriefId === "string") &&
      typeof threat.rationale === "string",
  );
}

function isStrategyDriftPayload(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  if (typeof value.strategyId !== "string") return false;
  if (!isFiniteNumber(value.coverageRate)) return false;
  if (!isFiniteNumber(value.rankingHealthRate)) return false;
  if (!Array.isArray(value.highOpportunityGaps)) return false;
  if (!Array.isArray(value.archetypeImbalances)) return false;
  if (!Array.isArray(value.pivotRecommendations)) return false;
  if (typeof value.digest !== "string") return false;

  return (
    value.highOpportunityGaps.every((k) => typeof k === "string") &&
    value.archetypeImbalances.every((k) => typeof k === "string") &&
    value.pivotRecommendations.every(
      (pivot) =>
        isObjectRecord(pivot) &&
        (pivot.type === "keyword" || pivot.type === "archetype" || pivot.type === "topic") &&
        typeof pivot.recommendation === "string" &&
        typeof pivot.rationale === "string",
    )
  );
}

function isPublishingPayload(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  if (typeof value.calendarItemId !== "string") return false;
  if (typeof value.briefId !== "string") return false;
  if (typeof value.keyword !== "string") return false;
  if (typeof value.archetype !== "string") return false;
  if (typeof value.strategyId !== "string") return false;
  if (value.wpConnectionId !== undefined && typeof value.wpConnectionId !== "string") return false;
  return true;
}

function assertValidAgentPayload(
  agentType:
    | "calendar"
    | "refresh"
    | "internal_links"
    | "competitive_response"
    | "strategy_drift"
    | "publishing",
  payload: unknown,
): void {
  const valid =
    (agentType === "calendar" && isCalendarPayload(payload)) ||
    (agentType === "refresh" && isRefreshPayload(payload)) ||
    (agentType === "internal_links" && isInternalLinksPayload(payload)) ||
    (agentType === "competitive_response" && isCompetitiveResponsePayload(payload)) ||
    (agentType === "strategy_drift" && isStrategyDriftPayload(payload)) ||
    (agentType === "publishing" && isPublishingPayload(payload));

  if (!valid) {
    throw new ConvexError(ERR_INVALID_AGENT_PAYLOAD);
  }
}

export const createForCron = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentType: agentTypeValidator,
    payload: v.any(),
    reasoning: v.string(),
    notificationTitle: v.string(),
    notificationBody: v.string(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    assertValidAgentPayload(args.agentType, args.payload);
    const now = Date.now();

    const actionId = await ctx.db.insert("agentActions", {
      workspaceId: args.workspaceId,
      agentType: args.agentType,
      status: "pending",
      payload: args.payload,
      reasoning: args.reasoning,
      suggestedAt: now,
    });

    await ctx.db.insert("notifications", {
      workspaceId: args.workspaceId,
      type: "agent_action_ready",
      agentType: args.agentType,
      agentActionId: actionId,
      title: args.notificationTitle,
      body: args.notificationBody,
      read: false,
      createdAt: now,
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: args.workspaceId,
      agentActionId: actionId,
      agentType: args.agentType,
      event: "suggested",
      actorType: "agent",
      createdAt: now,
    });

    return actionId;
  },
});

export const createAutoApproved = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentType: v.literal("publishing"),
    payload: v.any(),
    reasoning: v.string(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    assertValidAgentPayload(args.agentType, args.payload);

    const entries = await ctx.db
      .query("agentAuditLog")
      .withIndex("by_workspace_agent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("agentType", "publishing"),
      )
      .take(MAX_TRUST_AUDIT_ENTRIES);

    const decisions = entries.filter(
      (e) => (e.event === "approved" || e.event === "rejected") && e.actorType === "user",
    );
    const approvalCount = decisions.filter((e) => e.event === "approved").length;
    const totalDecisions = decisions.length;
    const approvalRate = totalDecisions > 0 ? approvalCount / totalDecisions : 0;

    const config = await ctx.db
      .query("publishingAgentConfig")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!config || config.status !== "active") {
      throw new ConvexError(ERR_PUBLISHING_AGENT_NOT_ACTIVE);
    }

    if (
      approvalCount < TRUSTED_MIN_DECISIONS ||
      approvalRate < TRUSTED_MIN_RATE
    ) {
      throw new ConvexError(ERR_TRUST_GATE_NOT_MET);
    }

    const now = Date.now();
    const actionId = await ctx.db.insert("agentActions", {
      workspaceId: args.workspaceId,
      agentType: "publishing",
      status: "approved",
      payload: args.payload,
      reasoning: args.reasoning,
      suggestedAt: now,
      decidedAt: now,
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: args.workspaceId,
      agentActionId: actionId,
      agentType: "publishing",
      event: "suggested",
      actorType: "agent",
      createdAt: now,
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: args.workspaceId,
      agentActionId: actionId,
      agentType: "publishing",
      event: "approved",
      actorType: "agent",
      createdAt: now,
    });

    return actionId;
  },
});

export const approve = mutation({
  args: { actionId: v.id("agentActions") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new ConvexError(ERR_AGENT_ACTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, action.workspaceId);
    if (action.status !== "pending") {
      throw new ConvexError(ERR_AGENT_ACTION_NOT_PENDING);
    }

    const now = Date.now();
    await ctx.db.patch(args.actionId, {
      status: "approved",
      decidedAt: now,
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: action.workspaceId,
      agentActionId: args.actionId,
      agentType: action.agentType,
      event: "approved",
      actorType: "user",
      createdAt: now,
    });
  },
});

export const reject = mutation({
  args: {
    actionId: v.id("agentActions"),
    userNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new ConvexError(ERR_AGENT_ACTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, action.workspaceId);
    if (action.status !== "pending") {
      throw new ConvexError(ERR_AGENT_ACTION_NOT_PENDING);
    }

    const now = Date.now();
    await ctx.db.patch(args.actionId, {
      status: "rejected",
      decidedAt: now,
      ...(args.userNote && { userNote: args.userNote }),
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: action.workspaceId,
      agentActionId: args.actionId,
      agentType: action.agentType,
      event: "rejected",
      actorType: "user",
      detail: args.userNote,
      createdAt: now,
    });

    if (action.agentType === "publishing") {
      const config = await ctx.db
        .query("publishingAgentConfig")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", action.workspaceId))
        .first();

      if (config) {
        await ctx.db.patch(config._id, {
          status: "paused",
          pauseReason: "user_rejected_publishing_action",
          pausedAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("publishingAgentConfig", {
          workspaceId: action.workspaceId,
          status: "paused",
          pauseReason: "user_rejected_publishing_action",
          pausedAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

export const markExecuting = mutation({
  args: {
    actionId: v.id("agentActions"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new ConvexError(ERR_AGENT_ACTION_NOT_FOUND);
    if (action.status !== "approved") {
      throw new ConvexError(ERR_AGENT_ACTION_NOT_APPROVED);
    }
    await ctx.db.patch(args.actionId, { status: "executing" });
  },
});

export const markDone = mutation({
  args: {
    actionId: v.id("agentActions"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new ConvexError(ERR_AGENT_ACTION_NOT_FOUND);
    if (action.status !== "approved") throw new ConvexError(ERR_AGENT_ACTION_NOT_APPROVED);
    const now = Date.now();
    await ctx.db.patch(args.actionId, {
      status: "done",
      executedAt: now,
    });

    await ctx.db.insert("notifications", {
      workspaceId: action.workspaceId,
      type: "agent_action_done",
      agentType: action.agentType,
      agentActionId: args.actionId,
      title: "Agent action completed",
      body: `${action.agentType} agent action was executed successfully.`,
      read: false,
      createdAt: now,
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: action.workspaceId,
      agentActionId: args.actionId,
      agentType: action.agentType,
      event: "executed",
      actorType: "agent",
      createdAt: now,
    });
  },
});

export const markDoneByUser = mutation({
  args: {
    actionId: v.id("agentActions"),
  },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new ConvexError(ERR_AGENT_ACTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, action.workspaceId);
    if (action.status !== "approved") throw new ConvexError(ERR_AGENT_ACTION_NOT_APPROVED);

    const now = Date.now();
    await ctx.db.patch(args.actionId, {
      status: "done",
      executedAt: now,
    });

    await ctx.db.insert("notifications", {
      workspaceId: action.workspaceId,
      type: "agent_action_done",
      agentType: action.agentType,
      agentActionId: args.actionId,
      title: "Agent action completed",
      body: `${action.agentType} agent action was executed successfully.`,
      read: false,
      createdAt: now,
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: action.workspaceId,
      agentActionId: args.actionId,
      agentType: action.agentType,
      event: "executed",
      actorType: "user",
      createdAt: now,
    });
  },
});

export const markFailed = mutation({
  args: {
    actionId: v.id("agentActions"),
    failureReason: v.string(),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new ConvexError(ERR_AGENT_ACTION_NOT_FOUND);
    if (action.status !== "approved") throw new ConvexError(ERR_AGENT_ACTION_NOT_APPROVED);
    const now = Date.now();
    await ctx.db.patch(args.actionId, {
      status: "failed",
      failureReason: args.failureReason,
      executedAt: now,
    });

    await ctx.db.insert("notifications", {
      workspaceId: action.workspaceId,
      type: "agent_action_failed",
      agentType: action.agentType,
      agentActionId: args.actionId,
      title: "Agent action failed",
      body: args.failureReason,
      read: false,
      createdAt: now,
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: action.workspaceId,
      agentActionId: args.actionId,
      agentType: action.agentType,
      event: "failed",
      actorType: "agent",
      detail: args.failureReason,
      createdAt: now,
    });
  },
});

export const markFailedByUser = mutation({
  args: {
    actionId: v.id("agentActions"),
    failureReason: v.string(),
  },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new ConvexError(ERR_AGENT_ACTION_NOT_FOUND);
    await requireWorkspaceAccess(ctx, action.workspaceId);
    if (action.status !== "approved") throw new ConvexError(ERR_AGENT_ACTION_NOT_APPROVED);

    const now = Date.now();
    await ctx.db.patch(args.actionId, {
      status: "failed",
      failureReason: args.failureReason,
      executedAt: now,
    });

    await ctx.db.insert("notifications", {
      workspaceId: action.workspaceId,
      type: "agent_action_failed",
      agentType: action.agentType,
      agentActionId: args.actionId,
      title: "Agent action failed",
      body: args.failureReason,
      read: false,
      createdAt: now,
    });

    await ctx.db.insert("agentAuditLog", {
      workspaceId: action.workspaceId,
      agentActionId: args.actionId,
      agentType: action.agentType,
      event: "failed",
      actorType: "user",
      detail: args.failureReason,
      createdAt: now,
    });
  },
});

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(agentActionStatusValidator),
    agentType: v.optional(agentTypeValidator),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    if (args.status && !args.agentType) {
      return ctx.db
        .query("agentActions")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .take(MAX_ACTIONS_PER_WORKSPACE);
    }

    if (args.agentType && !args.status) {
      return ctx.db
        .query("agentActions")
        .withIndex("by_workspace_agent", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("agentType", args.agentType!)
        )
        .order("desc")
        .take(MAX_ACTIONS_PER_WORKSPACE);
    }

    if (args.status && args.agentType) {
      const results = await ctx.db
        .query("agentActions")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .take(MAX_ACTIONS_PER_WORKSPACE);
      return results.filter((a) => a.agentType === args.agentType);
    }

    return ctx.db
      .query("agentActions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(MAX_ACTIONS_PER_WORKSPACE);
  },
});

export const getById = query({
  args: { actionId: v.id("agentActions") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action) return null;
    await requireWorkspaceAccess(ctx, action.workspaceId);
    return action;
  },
});

export const listApprovedForCron = query({
  args: { cronKey: v.string() },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return ctx.db
      .query("agentActions")
      .withIndex("by_status_suggested", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(MAX_APPROVED_ACTIONS_PER_RUN);
  },
});
