import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { analyzeCalendar } from "@/lib/agents/calendar-agent";
import { sendAgentDigestEmail } from "@/lib/email/resend";
import { getClerkUserPrimaryEmail } from "@/lib/email/user-email";

const MAX_WORKSPACES_PER_RUN = 500;

/**
 * Weekly Calendar Agent — fires Monday 09:00 UTC.
 * Analyzes keyword trends and performance, proposes calendar reprioritization.
 */
export const weeklyCalendarAgent = inngest.createFunction(
  { id: "weekly-calendar-agent", name: "Weekly Calendar Agent" },
  { cron: "0 9 * * 1" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[calendar-agent] INNGEST_CRON_KEY not configured");
      return { processed: 0, actions: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () => {
      return convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      });
    });

    let actions = 0;
    const now = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

    for (const workspace of workspaces) {
      const data = await step.run(`load-data-${workspace._id}`, async () => {
        const [calendarItems, strategies] = await Promise.all([
          convex.query(api.contentCalendar.listByWorkspaceForCron, {
            workspaceId: workspace._id,
            fromDate: now,
            toDate: now + sixtyDaysMs,
            cronKey,
          }),
          convex.query(api.strategies.listByWorkspaceForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
        ]);
        return { calendarItems, strategies };
      });

      if (data.calendarItems.length === 0) continue;

      const activeStrategy = data.strategies.find(
        (s: { status: string }) => s.status === "active"
      );
      if (!activeStrategy) continue;

      const keywords = await step.run(`load-keywords-${workspace._id}`, async () => {
        return convex.query(api.keywords.listByStrategyForCron, {
          strategyId: activeStrategy._id,
          workspaceId: workspace._id,
          cronKey,
        });
      });

      const payload = await step.run(`analyze-${workspace._id}`, async () => {
        return analyzeCalendar({
          strategyId: activeStrategy._id,
          calendarItems: data.calendarItems,
          keywords,
          performanceMetrics: [],
        });
      });

      if (!payload) continue;

      await step.run(`create-action-${workspace._id}`, async () => {
        const actionId = await convex.mutation(api.agentActions.createForCron, {
          workspaceId: workspace._id,
          agentType: "calendar",
          payload,
          reasoning: payload.digest,
          notificationTitle: "Calendar Reprioritization Ready",
          notificationBody: `${payload.proposedChanges.length} calendar changes proposed`,
          cronKey,
        });

        // Fire-and-forget email
        if (workspace.clerkUserId) {
          const recipientEmail = await getClerkUserPrimaryEmail(workspace.clerkUserId);
          if (!recipientEmail) return actionId;

          sendAgentDigestEmail({
            to: recipientEmail,
            agentType: "calendar",
            digest: payload.digest,
            actionId,
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.demandleaf.com",
          }).catch(() => {});
        }

        return actionId;
      });

      actions++;
    }

    return { processed: workspaces.length, actions };
  }
);
