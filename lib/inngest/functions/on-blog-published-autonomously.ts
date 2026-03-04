import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

/**
 * Coordination: Publishing Agent → Calendar + Internal Links.
 * When a blog is published autonomously, mark the calendar item as completed
 * and trigger the Internal Links Agent.
 */
export const onBlogPublishedAutonomously = inngest.createFunction(
  { id: "on-blog-published-autonomously", name: "Auto-Publish → Calendar + Links Coordination" },
  { event: "agent/blog-published-autonomously" },
  async ({ event, step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[auto-publish-coord] INNGEST_CRON_KEY not configured");
      return { coordinated: false };
    }

    const data = event.data as Record<string, unknown> | undefined;
    const workspaceId = typeof data?.workspaceId === "string" ? data.workspaceId : null;
    const blogId = typeof data?.blogId === "string" ? data.blogId : null;
    const keyword = typeof data?.keyword === "string" ? data.keyword : "";
    const calendarItemId =
      typeof data?.calendarItemId === "string" ? data.calendarItemId : "";

    if (!workspaceId || !blogId) {
      console.warn("[auto-publish-coord] Missing required event data:", data);
      return { coordinated: false };
    }

    // Mark calendar item as completed
    if (calendarItemId) {
      const validCalendarId = parseConvexId(calendarItemId, "contentCalendar");
      if (validCalendarId) {
        await step.run("complete-calendar-item", async () => {
          try {
            await convex.mutation(api.contentCalendar.updateStatusForCron, {
              calendarId: validCalendarId,
              status: "completed",
              cronKey,
            });
          } catch (err) {
            console.warn("[auto-publish-coord] Failed to complete calendar item:", err);
          }
        });
      }
    }

    // Trigger Internal Links Agent via the existing blog/published event
    if (blogId && workspaceId && keyword) {
      await step.run("trigger-links-agent", async () => {
        await inngest.send({
          name: "blog/published",
          data: { blogId, workspaceId, focusKeyword: keyword },
        });
      });
    }

    return { coordinated: true };
  }
);
