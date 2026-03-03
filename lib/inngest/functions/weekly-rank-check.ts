import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRankPosition } from "@/lib/seo-data/dataforseo";

const BATCH_SIZE = 10;
const MAX_WORKSPACES_PER_RUN = 500;

/**
 * Weekly rank check — fires every Monday at 06:00 UTC.
 * For each workspace with published blogs + focusKeyword:
 *   1. Query published blogs
 *   2. For each blog: checkRankPosition() (DataForSEO, cache-first)
 *   3. Insert rankSnapshot via Convex mutation
 */
export const weeklyRankCheck = inngest.createFunction(
  { id: "weekly-rank-check", name: "Weekly Rank Check" },
  { cron: "0 6 * * 1" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;

    if (!cronKey) {
      console.error("[weekly-rank] INNGEST_CRON_KEY is not configured");
      return { checked: 0, workspaces: 0, failures: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () => {
      return convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      });
    });

    let checked = 0;
    let failures = 0;

    for (const workspace of workspaces) {
      const publishedBlogs = await step.run(`fetch-blogs-${workspace._id}`, async () => {
        return convex.query(api.blogs.listPublishedForCron, {
          workspaceId: workspace._id,
          cronKey,
        });
      });

      const eligibleBlogs = publishedBlogs.filter((blog) => blog.wpPostUrl && blog.focusKeyword);
      for (let i = 0; i < eligibleBlogs.length; i += BATCH_SIZE) {
        const batch = eligibleBlogs.slice(i, i + BATCH_SIZE);
        const batchResult = await step.run(`check-batch-${workspace._id}-${i}`, async () => {
          let batchChecked = 0;
          let batchFailures = 0;

          for (const blog of batch) {
            try {
              const result = await checkRankPosition(convex, blog.focusKeyword!, blog.wpPostUrl!);
              await convex.mutation(api.rankSnapshots.insertSnapshotForCron, {
                workspaceId: workspace._id,
                blogId: blog._id,
                keyword: blog.focusKeyword!,
                position: result.position ?? undefined,
                url: result.url ?? undefined,
                cronKey,
              });
              batchChecked += 1;
            } catch (err) {
              batchFailures += 1;
              console.error(`[weekly-rank] Failed for blog ${blog._id}:`, err);
            }
          }

          return { batchChecked, batchFailures };
        });

        checked += batchResult.batchChecked;
        failures += batchResult.batchFailures;
      }
    }

    return { checked, workspaces: workspaces.length, failures };
  }
);
