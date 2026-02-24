import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_UNAUTHORIZED } from "./errors";
import { calendarStatusValidator } from "./validators";
import type { Id } from "./_generated/dataModel";

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
      const strategyId = args.strategyId;
      const strategy = await ctx.db.get(strategyId);
      if (!strategy || strategy.workspaceId !== args.workspaceId) {
        throw new Error(ERR_UNAUTHORIZED);
      }

      if (args.fromDate !== undefined && args.toDate !== undefined) {
        return ctx.db
          .query("contentCalendar")
          .withIndex("by_workspace_strategy_date", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("strategyId", strategyId)
              .gte("scheduledDate", args.fromDate!)
              .lte("scheduledDate", args.toDate!),
          )
          .collect();
      }

      if (args.fromDate !== undefined) {
        return ctx.db
          .query("contentCalendar")
          .withIndex("by_workspace_strategy_date", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("strategyId", strategyId)
              .gte("scheduledDate", args.fromDate!),
          )
          .collect();
      }

      if (args.toDate !== undefined) {
        return ctx.db
          .query("contentCalendar")
          .withIndex("by_workspace_strategy_date", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("strategyId", strategyId)
              .lte("scheduledDate", args.toDate!),
          )
          .collect();
      }

      return ctx.db
        .query("contentCalendar")
        .withIndex("by_workspace_strategy_date", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("strategyId", strategyId),
        )
        .collect();
    }

    if (args.fromDate !== undefined && args.toDate !== undefined) {
      return ctx.db
        .query("contentCalendar")
        .withIndex("by_workspace_date", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .gte("scheduledDate", args.fromDate!)
            .lte("scheduledDate", args.toDate!),
        )
        .collect();
    }

    if (args.fromDate !== undefined) {
      return ctx.db
        .query("contentCalendar")
        .withIndex("by_workspace_date", (q) =>
          q.eq("workspaceId", args.workspaceId).gte("scheduledDate", args.fromDate!),
        )
        .collect();
    }

    if (args.toDate !== undefined) {
      return ctx.db
        .query("contentCalendar")
        .withIndex("by_workspace_date", (q) =>
          q.eq("workspaceId", args.workspaceId).lte("scheduledDate", args.toDate!),
        )
        .collect();
    }

    return ctx.db
      .query("contentCalendar")
      .withIndex("by_workspace_date", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
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
    const incomingKeywordIds = new Set(args.items.map((item) => item.keywordId));
    const existingForStrategy = await ctx.db
      .query("contentCalendar")
      .withIndex("by_strategy", (q) => q.eq("strategyId", args.strategyId))
      .collect();

    for (const existing of existingForStrategy) {
      if (!incomingKeywordIds.has(existing.keywordId)) {
        await ctx.db.delete(existing._id);
      }
    }

    const ids: Array<Id<"contentCalendar">> = [];

    for (const item of args.items) {
      const keyword = await ctx.db.get(item.keywordId);
      if (
        !keyword ||
        keyword.workspaceId !== args.workspaceId ||
        keyword.strategyId !== args.strategyId
      ) {
        throw new Error(ERR_UNAUTHORIZED);
      }

      const briefId = item.briefId;
      if (briefId) {
        const brief = await ctx.db.get(briefId);
        if (
          !brief ||
          brief.workspaceId !== args.workspaceId ||
          brief.keywordId !== item.keywordId
        ) {
          throw new Error(ERR_UNAUTHORIZED);
        }
      }

      const existing = await ctx.db
        .query("contentCalendar")
        .withIndex("by_strategy_keyword", (q) =>
          q.eq("strategyId", args.strategyId).eq("keywordId", item.keywordId),
        )
        .first();

      if (existing) {
        const resolvedBriefId = briefId ?? existing.briefId;
        await ctx.db.patch(existing._id, {
          briefId: resolvedBriefId,
          scheduledDate: item.scheduledDate,
          archetype: item.archetype,
          priority: item.priority,
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
    if (Object.keys(patch).length > 0) await ctx.db.patch(args.calendarId, patch);
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
    await ctx.db.patch(args.calendarId, { status: args.status });
  },
});
