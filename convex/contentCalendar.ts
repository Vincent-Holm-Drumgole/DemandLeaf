import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_UNAUTHORIZED } from "./errors";
import { calendarStatusValidator } from "./validators";
import type { Id } from "./_generated/dataModel";

const MAX_CALENDAR_QUERY_RESULTS = 1_000;
const MAX_EXISTING_ITEMS_PER_STRATEGY = 2_000;

async function queryByStrategy(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  strategyId: Id<"strategies">,
  fromDate: number | undefined,
  toDate: number | undefined,
) {
  if (fromDate !== undefined && toDate !== undefined) {
    return ctx.db
      .query("contentCalendar")
      .withIndex("by_workspace_strategy_date", (q) =>
        q.eq("workspaceId", workspaceId).eq("strategyId", strategyId)
          .gte("scheduledDate", fromDate).lte("scheduledDate", toDate),
      )
      .take(MAX_CALENDAR_QUERY_RESULTS);
  }
  if (fromDate !== undefined) {
    return ctx.db
      .query("contentCalendar")
      .withIndex("by_workspace_strategy_date", (q) =>
        q.eq("workspaceId", workspaceId).eq("strategyId", strategyId)
          .gte("scheduledDate", fromDate),
      )
      .take(MAX_CALENDAR_QUERY_RESULTS);
  }
  if (toDate !== undefined) {
    return ctx.db
      .query("contentCalendar")
      .withIndex("by_workspace_strategy_date", (q) =>
        q.eq("workspaceId", workspaceId).eq("strategyId", strategyId)
          .lte("scheduledDate", toDate),
      )
      .take(MAX_CALENDAR_QUERY_RESULTS);
  }
  return ctx.db
    .query("contentCalendar")
    .withIndex("by_workspace_strategy_date", (q) =>
      q.eq("workspaceId", workspaceId).eq("strategyId", strategyId),
    )
    .take(MAX_CALENDAR_QUERY_RESULTS);
}

async function queryByWorkspace(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  fromDate: number | undefined,
  toDate: number | undefined,
) {
  if (fromDate !== undefined && toDate !== undefined) {
    return ctx.db
      .query("contentCalendar")
      .withIndex("by_workspace_date", (q) =>
        q.eq("workspaceId", workspaceId).gte("scheduledDate", fromDate).lte("scheduledDate", toDate),
      )
      .take(MAX_CALENDAR_QUERY_RESULTS);
  }
  if (fromDate !== undefined) {
    return ctx.db
      .query("contentCalendar")
      .withIndex("by_workspace_date", (q) =>
        q.eq("workspaceId", workspaceId).gte("scheduledDate", fromDate),
      )
      .take(MAX_CALENDAR_QUERY_RESULTS);
  }
  if (toDate !== undefined) {
    return ctx.db
      .query("contentCalendar")
      .withIndex("by_workspace_date", (q) =>
        q.eq("workspaceId", workspaceId).lte("scheduledDate", toDate),
      )
      .take(MAX_CALENDAR_QUERY_RESULTS);
  }
  return ctx.db
    .query("contentCalendar")
    .withIndex("by_workspace_date", (q) => q.eq("workspaceId", workspaceId))
    .take(MAX_CALENDAR_QUERY_RESULTS);
}

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    strategyId: v.optional(v.id("strategies")),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    if (args.strategyId) {
      const strategy = await ctx.db.get(args.strategyId);
      if (!strategy || strategy.workspaceId !== args.workspaceId) {
        throw new Error(ERR_UNAUTHORIZED);
      }
      return queryByStrategy(ctx, args.workspaceId, args.strategyId, args.fromDate, args.toDate);
    }

    return queryByWorkspace(ctx, args.workspaceId, args.fromDate, args.toDate);
  },
});

export const bulkCreate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    items: v.array(
      v.object({
        briefId: v.optional(v.id("contentBriefs")),
        keywordId: v.id("keywords"),
        scheduledDate: v.number(),
        archetype: v.string(),
        priority: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const strategy = await ctx.db.get(args.strategyId);
    if (!strategy || strategy.workspaceId !== args.workspaceId) {
      throw new Error(ERR_UNAUTHORIZED);
    }

    const now = Date.now();

    // Pre-fetch all referenced keywords, briefs, and existing calendar entries in
    // parallel — replaces the ~3n sequential reads that the per-item loop would incur.
    const uniqueBriefIds = [
      ...new Set(args.items.map((i) => i.briefId).filter((id): id is Id<"contentBriefs"> => id !== undefined)),
    ];

    const [keywords, briefs, existingForStrategy] = await Promise.all([
      Promise.all(args.items.map((item) => ctx.db.get(item.keywordId))),
      Promise.all(uniqueBriefIds.map((id) => ctx.db.get(id))),
      ctx.db
        .query("contentCalendar")
        .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
        .take(MAX_EXISTING_ITEMS_PER_STRATEGY),
    ]);

    // Build lookup Maps for O(1) access during the upsert loop.
    const briefMap = new Map(briefs.map((b) => b && [b._id, b]).filter(Boolean) as [Id<"contentBriefs">, NonNullable<(typeof briefs)[number]>][]);
    const existingByKeyword = new Map(existingForStrategy.map((e) => [e.keywordId, e]));

    // Delete calendar entries whose keywords are no longer in the incoming set.
    const incomingKeywordIds = new Set(args.items.map((item) => item.keywordId));
    for (const existing of existingForStrategy) {
      if (!incomingKeywordIds.has(existing.keywordId)) {
        await ctx.db.delete(existing._id);
      }
    }

    const ids: Array<Id<"contentCalendar">> = [];

    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      const keyword = keywords[i];
      if (
        !keyword ||
        keyword.workspaceId !== args.workspaceId ||
        keyword.strategyId !== args.strategyId
      ) {
        throw new Error(ERR_UNAUTHORIZED);
      }

      const briefId = item.briefId;
      if (briefId) {
        const brief = briefMap.get(briefId);
        if (
          !brief ||
          brief.workspaceId !== args.workspaceId ||
          brief.keywordId !== item.keywordId
        ) {
          throw new Error(ERR_UNAUTHORIZED);
        }
      }

      const existing = existingByKeyword.get(item.keywordId);

      if (existing) {
        const resolvedBriefId = briefId ?? existing.briefId;
        await ctx.db.patch(existing._id, {
          briefId: resolvedBriefId,
          scheduledDate: item.scheduledDate,
          archetype: item.archetype,
          priority: item.priority,
          updatedAt: now,
        });
        ids.push(existing._id);
      } else {
        const id = await ctx.db.insert("contentCalendar", {
          workspaceId: args.workspaceId,
          strategyId: args.strategyId,
          briefId,
          keywordId: item.keywordId,
          scheduledDate: item.scheduledDate,
          archetype: item.archetype,
          priority: item.priority,
          status: "scheduled",
          createdAt: now,
          updatedAt: now,
        });
        ids.push(id);
      }
    }

    return ids;
  },
});

export const reschedule = mutation({
  args: {
    calendarId: v.id("contentCalendar"),
    scheduledDate: v.optional(v.number()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.calendarId);
    if (!item) {
      throw new Error("Calendar item not found");
    }
    await requireWorkspaceAccess(ctx, item.workspaceId);
    const patch: Record<string, unknown> = {};
    if (args.scheduledDate !== undefined && Number.isFinite(args.scheduledDate)) {
      patch.scheduledDate = args.scheduledDate;
    }
    if (args.priority !== undefined && Number.isFinite(args.priority) && args.priority >= 1) {
      patch.priority = args.priority;
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = Date.now();
      await ctx.db.patch(args.calendarId, patch);
    }
  },
});

export const updateStatus = mutation({
  args: {
    calendarId: v.id("contentCalendar"),
    status: calendarStatusValidator,
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.calendarId);
    if (!item) {
      throw new Error("Calendar item not found");
    }
    await requireWorkspaceAccess(ctx, item.workspaceId);
    await ctx.db.patch(args.calendarId, { status: args.status, updatedAt: Date.now() });
  },
});

/**
 * Atomically update scheduledDate, priority, and/or status in a single transaction.
 * Prefer this over calling reschedule + updateStatus sequentially when both are needed.
 */
export const update = mutation({
  args: {
    calendarId: v.id("contentCalendar"),
    scheduledDate: v.optional(v.number()),
    priority: v.optional(v.number()),
    status: v.optional(calendarStatusValidator),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.calendarId);
    if (!item) throw new Error("Calendar item not found");
    await requireWorkspaceAccess(ctx, item.workspaceId);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.scheduledDate !== undefined && Number.isFinite(args.scheduledDate)) {
      patch.scheduledDate = args.scheduledDate;
    }
    if (args.priority !== undefined && Number.isFinite(args.priority) && args.priority >= 1) {
      patch.priority = args.priority;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    await ctx.db.patch(args.calendarId, patch);
  },
});
