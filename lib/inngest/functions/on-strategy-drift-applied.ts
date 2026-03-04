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
    if (!cronKey) return { coordinated: false };

    const { workspaceId, strategyId } = event.data as {
      workspaceId: string;
      strategyId: string;
    };

    const validWorkspaceId = parseConvexId(workspaceId, "workspaces");
    const validStrategyId = parseConvexId(strategyId, "strategies");
    if (!validWorkspaceId || !validStrategyId) return { coordinated: false };

    const now = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

    const data = await step.run("load-calendar-data", async () => {
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

    if (data.calendarItems.length === 0) return { coordinated: false };

    const payload = await step.run("analyze-calendar", async () => {
      return analyzeCalendar({
        strategyId: validStrategyId,
        calendarItems: data.calendarItems,
        keywords: data.keywords,
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
