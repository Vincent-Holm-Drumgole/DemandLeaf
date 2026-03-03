import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  detectRankDecay,
  detectTrafficDecay,
  filterNewAlerts,
} from "@/lib/decay/detector";
import type { DecaySignal } from "@/types";

const ESCALATION_THRESHOLD_MS = 28 * 24 * 60 * 60 * 1000; // 4 weeks
const MAX_WORKSPACES_PER_RUN = 500;

/**
 * Daily decay scan — fires daily at 08:00 UTC.
 * 1. Load recent rank snapshots + performance metrics per workspace
 * 2. Run detectRankDecay + detectTrafficDecay for each blog
 * 3. Filter new alerts (de-duplicate against existing open alerts)
 * 4. Create new decayAlerts
 * 5. FM-7: Escalate "refreshing" alerts older than 28 days
 */
export const dailyDecayScan = inngest.createFunction(
  { id: "daily-decay-scan", name: "Daily Decay Alert Scan" },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;

    if (!cronKey) {
      console.error("[daily-decay] INNGEST_CRON_KEY is not configured");
      return { scanned: 0, alertsCreated: 0, escalated: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () => {
      return convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      });
    });

    let alertsCreated = 0;
    let escalated = 0;

    for (const workspace of workspaces) {
      const since21d = Date.now() - 21 * 24 * 60 * 60 * 1000;
      const since8w = Date.now() - 8 * 7 * 24 * 60 * 60 * 1000;

      const [snapshots, metrics, existingAlerts, publishedBlogs] = await step.run(
        `load-data-${workspace._id}`,
        async () =>
          Promise.all([
            convex.query(api.rankSnapshots.getRecentForWorkspaceForCron, {
              workspaceId: workspace._id,
              since: since21d,
              cronKey,
            }),
            convex.query(api.performanceMetrics.getRecentForWorkspaceForCron, {
              workspaceId: workspace._id,
              since: since8w,
              cronKey,
            }),
            convex.query(api.decayAlerts.listByWorkspaceForCron, {
              workspaceId: workspace._id,
              cronKey,
            }),
            convex.query(api.blogs.listPublishedForCron, {
              workspaceId: workspace._id,
              cronKey,
            }),
          ])
      );

      const allSignals: DecaySignal[] = [];
      for (const blog of publishedBlogs) {
        if (!blog.focusKeyword) continue;

        const blogSnapshots = snapshots
          .filter((snapshot) => snapshot.blogId === blog._id)
          .map((snapshot) => ({
            keyword: snapshot.keyword,
            checkedAt: snapshot.checkedAt,
            position: snapshot.position ?? null,
          }));
        const rankSignal = detectRankDecay(blogSnapshots, blog.focusKeyword);
        if (rankSignal) {
          rankSignal.blogId = blog._id;
          allSignals.push(rankSignal);
        }

        const blogMetrics = metrics
          .filter((metric) => metric.blogId === blog._id)
          .map((metric) => ({
            sessions: metric.sessions ?? null,
            clicks: metric.clicks ?? null,
            ctr: metric.ctr ?? null,
            impressions: metric.impressions ?? null,
            periodStart: metric.periodStart,
          }));
        const trafficSignals = detectTrafficDecay(blogMetrics, blog._id);
        allSignals.push(...trafficSignals);
      }

      const newSignals = filterNewAlerts(allSignals, existingAlerts);
      if (newSignals.length > 0) {
        const created = await step.run(`create-alerts-${workspace._id}`, async () => {
          let count = 0;
          for (const signal of newSignals) {
            await convex.mutation(api.decayAlerts.createForCron, {
              workspaceId: workspace._id,
              blogId: signal.blogId as Id<"blogs">,
              alertType: signal.alertType,
              severity: signal.severity,
              baselineValue: signal.baselineValue,
              currentValue: signal.currentValue,
              deltaPercent: signal.deltaPercent,
              cronKey,
            });
            count += 1;
          }
          return count;
        });
        alertsCreated += created;
      }

      const workspaceEscalated = await step.run(`escalate-${workspace._id}`, async () => {
        const now = Date.now();
        let count = 0;
        for (const alert of existingAlerts) {
          if (alert.status === "refreshing" && now - alert.triggeredAt > ESCALATION_THRESHOLD_MS) {
            await convex.mutation(api.decayAlerts.updateStatusForCron, {
              alertId: alert._id,
              status: "escalated",
              cronKey,
            });
            count += 1;
          }
        }
        return count;
      });

      escalated += workspaceEscalated;
    }

    return { scanned: workspaces.length, alertsCreated, escalated };
  }
);
