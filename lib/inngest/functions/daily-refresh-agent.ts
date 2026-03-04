import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { analyzeRefreshNeeds } from "@/lib/agents/refresh-agent";

const MAX_WORKSPACES_PER_RUN = 500;

/**
 * Daily Refresh Agent — fires daily 10:00 UTC.
 * Detects blogs needing refresh (decay alerts + staleness) and generates briefs.
 */
export const dailyRefreshAgent = inngest.createFunction(
  { id: "daily-refresh-agent", name: "Daily Refresh Agent" },
  { cron: "0 10 * * *" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[refresh-agent] INNGEST_CRON_KEY not configured");
      return { processed: 0, actions: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () => {
      return convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      });
    });

    let actions = 0;

    for (const workspace of workspaces) {
      const data = await step.run(`load-data-${workspace._id}`, async () => {
        const [blogs, alerts] = await Promise.all([
          convex.query(api.blogs.listPublishedForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
          convex.query(api.decayAlerts.listByWorkspaceForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
        ]);
        return { blogs, alerts };
      });

      const openCriticalAlerts = data.alerts.filter(
        (a: { status: string; severity: string }) =>
          a.status === "open" && a.severity === "critical"
      );

      if (openCriticalAlerts.length === 0 && data.blogs.length === 0) continue;

      const payload = await step.run(`analyze-${workspace._id}`, async () => {
        return analyzeRefreshNeeds(
          convex,
          data.blogs.map((b: {
            _id: string;
            title: string;
            content: string;
            focusKeyword?: string;
            wordCount?: number;
            publishedAt?: number;
          }) => ({
            _id: b._id,
            title: b.title,
            content: b.content,
            focusKeyword: b.focusKeyword ?? "",
            wordCount: b.wordCount,
            publishedAt: b.publishedAt,
          })),
          openCriticalAlerts
        );
      });

      if (!payload) continue;

      const digest = `## Content Refresh Needed — ${payload.alerts.length} posts flagged

${payload.alerts.map((a) => `- **${a.blogTitle}** (${a.alertType}, ${a.severity}) — ~${a.estimatedReworkPercent}% rework`).join("\n")}`;

      await step.run(`create-action-${workspace._id}`, async () => {
        await convex.mutation(api.agentActions.createForCron, {
          workspaceId: workspace._id,
          agentType: "refresh",
          payload,
          reasoning: digest,
          notificationTitle: "Content Refresh Recommended",
          notificationBody: `${payload.alerts.length} posts need updating`,
          cronKey,
        });
      });

      // Mark processed alerts as acknowledged
      await step.run(`ack-alerts-${workspace._id}`, async () => {
        for (const alert of openCriticalAlerts) {
          try {
            await convex.mutation(api.decayAlerts.updateStatusForCron, {
              alertId: alert._id,
              status: "acknowledged",
              cronKey,
            });
          } catch {
            // Non-critical
          }
        }
      });

      actions++;
    }

    return { processed: workspaces.length, actions };
  }
);
