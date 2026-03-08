import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

const MAX_WORKSPACES_PER_RUN = 500;

export const monthlyKbReviewReminder = inngest.createFunction(
  { id: "monthly-kb-review-reminder", name: "Monthly KB Review Reminder" },
  { cron: "0 12 1 * *" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[kb-review-reminder] INNGEST_CRON_KEY not configured");
      return { processed: 0, notifications: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () =>
      convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      }),
    );

    let notifications = 0;

    for (const workspace of workspaces) {
      try {
        const dueEntries = await step.run(`load-due-entries-${workspace._id}`, async () =>
          convex.query(api.knowledgeBase.listDueForReviewForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
        );
        if (dueEntries.length === 0) continue;

        await step.run(`create-review-notification-${workspace._id}`, async () =>
          convex.mutation(api.notifications.createForCron, {
            workspaceId: workspace._id,
            type: "kb_review_due",
            title: "Knowledge base review due",
            body: `${dueEntries.length} entries have not been verified in the last 90 days.`,
            cronKey,
          }),
        );
        notifications += 1;
      } catch (error) {
        console.error(`[kb-review-reminder] Failed for workspace ${workspace._id}:`, error);
      }
    }

    return { processed: workspaces.length, notifications };
  },
);
