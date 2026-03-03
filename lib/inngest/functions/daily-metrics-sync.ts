import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { decryptTokens } from "@/lib/google/credentials";
import { getPostMetrics } from "@/lib/google/ga4-client";
import { getPostSearchMetrics } from "@/lib/google/gsc-client";

const MAX_WORKSPACES_PER_RUN = 500;

/**
 * Daily metrics sync — fires daily at 07:00 UTC.
 * For each workspace with a Google connection:
 *   1. Decrypt tokens, refresh if expired
 *   2. For each published blog: fetch GA4 + GSC metrics for yesterday
 *   3. Upsert performanceMetrics
 *
 * FM-5: If GA4/GSC API fails, patch connection status to "error" and continue.
 */
export const dailyMetricsSync = inngest.createFunction(
  { id: "daily-metrics-sync", name: "Daily GA4/GSC Metrics Sync" },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;

    if (!cronKey) {
      console.error("[daily-metrics] INNGEST_CRON_KEY is not configured");
      return { synced: 0, workspaces: 0, errors: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () => {
      return convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      });
    });

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const startDate = yesterday.toISOString().slice(0, 10);
    const endDate = startDate;
    const periodStart = Date.UTC(
      yesterday.getUTCFullYear(),
      yesterday.getUTCMonth(),
      yesterday.getUTCDate()
    );
    const periodEnd = periodStart + 24 * 60 * 60 * 1000;

    let synced = 0;
    let errors = 0;

    for (const workspace of workspaces) {
      const connection = await step.run(`get-google-conn-${workspace._id}`, async () => {
        return convex.query(api.googleConnections.getByWorkspaceForCron, {
          workspaceId: workspace._id,
          cronKey,
        });
      });

      if (!connection || connection.status !== "connected") continue;

      let tokens;
      try {
        tokens = decryptTokens(
          connection.encryptedTokens,
          connection.tokenIv,
          connection.tokenTag
        );
      } catch (err) {
        errors += 1;
        console.error(
          `[daily-metrics] Failed to decrypt Google tokens for workspace ${workspace._id}:`,
          err
        );
        await step.run(`mark-google-error-${workspace._id}`, async () => {
          await convex.mutation(api.googleConnections.updateStatusForCron, {
            connectionId: connection._id,
            status: "error",
            cronKey,
          });
        });
        continue;
      }

      const blogs = await step.run(`fetch-blogs-${workspace._id}`, async () => {
        return convex.query(api.blogs.listPublishedForCron, {
          workspaceId: workspace._id,
          cronKey,
        });
      });

      const published = blogs.filter((blog) => blog.wpPostUrl);
      if (published.length === 0) continue;

      const workspaceSynced = await step.run(`sync-metrics-${workspace._id}`, async () => {
        let count = 0;
        for (const blog of published) {
          try {
            const ga4 = connection.ga4PropertyId
              ? await getPostMetrics(
                  tokens,
                  connection.ga4PropertyId,
                  blog.wpPostUrl!,
                  startDate,
                  endDate
                )
              : null;
            const gsc = connection.gscSiteUrl
              ? await getPostSearchMetrics(
                  tokens,
                  connection.gscSiteUrl,
                  blog.wpPostUrl!,
                  startDate,
                  endDate
                )
              : null;

            if (!ga4 && !gsc) continue;

            await convex.mutation(api.performanceMetrics.upsertMetricsForCron, {
              workspaceId: workspace._id,
              blogId: blog._id,
              sessions: ga4?.sessions,
              pageviews: ga4?.pageviews,
              avgEngagementTimeSec: ga4?.avgEngagementTimeSec,
              bounceRate: ga4?.bounceRate,
              clicks: gsc?.clicks,
              impressions: gsc?.impressions,
              ctr: gsc?.ctr,
              avgPosition: gsc?.avgPosition,
              periodStart,
              periodEnd,
              cronKey,
            });
            count += 1;
          } catch (err) {
            errors += 1;
            console.error(`[daily-metrics] Failed for blog ${blog._id}:`, err);
          }
        }
        return count;
      });

      synced += workspaceSynced;
    }

    return { synced, workspaces: workspaces.length, errors };
  }
);
