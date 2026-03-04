import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { analyzeCalendar } from "@/lib/agents/calendar-agent";

/**
 * Coordination: Strategy Drift → Calendar Agent.
 * When drift pivots are applied, re-analyze the content calendar.
 */
export const onStrategyDriftApplied = inngest.createFunction(
  { id: "on-strategy-drift-applied", name: "Drift → Calendar Coordination" },
  { event: "agent/strategy-drift-applied" },
  async ({ event, step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[drift-coord] INNGEST_CRON_KEY not configured");
      return { coordinated: false };
    }

    const data = event.data as Record<string, unknown> | undefined;
    const workspaceIdRaw =
      typeof data?.workspaceId === "string" ? data.workspaceId : null;
    const strategyIdRaw =
      typeof data?.strategyId === "string" ? data.strategyId : null;
    if (!workspaceIdRaw || !strategyIdRaw) {
      console.warn("[drift-coord] Missing required event data. workspaceId:", typeof data?.workspaceId, "strategyId:", typeof data?.strategyId);
      return { coordinated: false };
    }

    const validWorkspaceId = parseConvexId(workspaceIdRaw, "workspaces");
    const validStrategyId = parseConvexId(strategyIdRaw, "strategies");
    if (!validWorkspaceId || !validStrategyId) return { coordinated: false };

    const now = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

    const calendarData = await step.run("load-calendar-data", async () => {
      const [calendarItems, keywords] = await Promise.all([
        convex.query(api.contentCalendar.listByWorkspaceForCron, {
          workspaceId: validWorkspaceId,
          fromDate: now,
          toDate: now + sixtyDaysMs,
          cronKey,
        }),
        convex.query(api.keywords.listByStrategyForCron, {
          strategyId: validStrategyId,
          workspaceId: validWorkspaceId,
          cronKey,
        }),
      ]);
      return { calendarItems, keywords };
    });

    if (calendarData.calendarItems.length === 0) return { coordinated: false };

    const payload = await step.run("analyze-calendar", async () => {
      return analyzeCalendar({
        strategyId: validStrategyId,
        calendarItems: calendarData.calendarItems,
        keywords: calendarData.keywords,
      });
    });

    if (!payload) return { coordinated: false };

    await step.run("create-calendar-action", async () => {
      await convex.mutation(api.agentActions.createForCron, {
        workspaceId: validWorkspaceId,
        agentType: "calendar",
        payload,
        reasoning: `[Triggered by Strategy Drift] ${payload.digest}`,
        notificationTitle: "Calendar Update (from Strategy Drift)",
        notificationBody: `${payload.proposedChanges.length} changes proposed after strategy pivot`,
        cronKey,
      });
    });

    return { coordinated: true };
  }
);
