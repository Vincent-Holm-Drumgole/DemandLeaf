import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { executePublishing } from "@/lib/agents/executors/publishing-executor";
import type { Id } from "@/convex/_generated/dataModel";

const MAX_WORKSPACES_PER_RUN = 500;

/**
 * Daily Publishing Agent — fires daily 12:00 UTC.
 * Autonomously generates and publishes blogs from approved briefs.
 * Requires trust gate (20+ approvals, 90%+ rate) and active config.
 */
export const dailyPublishingAgent = inngest.createFunction(
  { id: "daily-publishing-agent", name: "Daily Publishing Agent" },
  { cron: "0 12 * * *" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[publishing-agent] INNGEST_CRON_KEY not configured");
      return { processed: 0, published: 0, paused: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () => {
      return convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      });
    });

    let published = 0;
    let paused = 0;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    for (const workspace of workspaces) {
      // Check trust gate
      const gate = await step.run(`check-gate-${workspace._id}`, async () => {
        return convex.query(api.agentTrust.getPublishingGateStatusForCron, {
          workspaceId: workspace._id,
          cronKey,
        });
      });

      if (!gate.eligible) continue;

      // Load next scheduled calendar item
      const calendarItem = await step.run(`load-calendar-${workspace._id}`, async () => {
        const items = await convex.query(api.contentCalendar.listByWorkspaceForCron, {
          workspaceId: workspace._id,
          fromDate: 0,
          toDate: now + twentyFourHours,
          cronKey,
        });
        return items.find(
          (item: { status: string; scheduledDate: number }) =>
            item.status === "scheduled" && item.scheduledDate <= now + twentyFourHours
        ) ?? null;
      });

      if (!calendarItem) continue;

      // Check for associated approved brief
      const brief = calendarItem.briefId
        ? await step.run(`load-brief-${workspace._id}`, async () => {
            return convex.query(api.contentBriefs.getByIdForCron, {
              briefId: calendarItem.briefId!,
              workspaceId: workspace._id,
              cronKey,
            });
          })
        : null;

      if (!brief || brief.status !== "approved") continue;

      // Create auto-approved action
      let actionId: Id<"agentActions"> | null = null;
      try {
        actionId = await step.run(`auto-approve-${workspace._id}`, async () => {
          return convex.mutation(api.agentActions.createAutoApproved, {
            workspaceId: workspace._id,
            agentType: "publishing",
            payload: {
              calendarItemId: calendarItem._id,
              briefId: brief._id,
              keyword: brief.briefData.targetKeyword,
              archetype: brief.briefData.archetypeRecommendation,
              strategyId: calendarItem.strategyId,
            },
            reasoning: `Auto-publishing "${brief.briefData.targetKeyword}" from approved brief`,
            cronKey,
          });
        });
      } catch (err) {
        console.warn("[publishing-agent] createAutoApproved failed:", err);
        continue;
      }

      if (!actionId) continue;

      // Execute
      let result:
        | { blogId: string | null; published: boolean; paused: boolean }
        | null = null;
      try {
        result = await step.run(`execute-${workspace._id}`, async () => {
          return executePublishing(
            convex,
            workspace._id,
            {
              calendarItemId: calendarItem._id,
              briefId: brief._id,
              keyword: brief.briefData.targetKeyword,
              archetype: brief.briefData.archetypeRecommendation,
              strategyId: calendarItem.strategyId,
            },
            cronKey
          );
        });
      } catch (err) {
        await step.run(`mark-failed-exec-${workspace._id}`, async () => {
          await convex.mutation(api.agentActions.markFailed, {
            actionId,
            failureReason:
              err instanceof Error ? err.message.slice(0, 500) : "Publishing execution failed",
            cronKey,
          });
        });
        continue;
      }
      if (!result) continue;

      if (result.paused) {
        paused++;
        await step.run(`mark-failed-${workspace._id}`, async () => {
          await convex.mutation(api.agentActions.markFailed, {
            actionId,
            failureReason: "Safety rail triggered — agent paused",
            cronKey,
          });
        });
        continue;
      }

      if (result.blogId) {
        published++;
        await step.run(`mark-done-${workspace._id}`, async () => {
          await convex.mutation(api.agentActions.markDone, {
            actionId,
            cronKey,
          });
        });
      } else {
        await step.run(`mark-failed-empty-${workspace._id}`, async () => {
          await convex.mutation(api.agentActions.markFailed, {
            actionId,
            failureReason: "Publishing executor completed without creating a blog",
            cronKey,
          });
        });
      }
    }

    return { processed: workspaces.length, published, paused };
  }
);
