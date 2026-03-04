import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { analyzeInternalLinks } from "@/lib/agents/internal-links-agent";
import { parseConvexId } from "@/lib/convex-id";

/**
 * Internal Links Agent — fires on blog/published event.
 * Scans existing posts for cross-linking opportunities to the new post.
 */
export const blogPublishedLinksAgent = inngest.createFunction(
  { id: "blog-published-links-agent", name: "Internal Links Agent" },
  { event: "blog/published" },
  async ({ event, step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[links-agent] INNGEST_CRON_KEY not configured");
      return { processed: false };
    }

    const { blogId, workspaceId, focusKeyword } = event.data as {
      blogId: string;
      workspaceId: string;
      focusKeyword: string;
    };

    if (!blogId || !workspaceId || !focusKeyword) {
      console.error("[links-agent] Missing event data");
      return { processed: false };
    }

    const validBlogId = parseConvexId(blogId, "blogs");
    const validWorkspaceId = parseConvexId(workspaceId, "workspaces");
    if (!validBlogId || !validWorkspaceId) {
      console.error("[links-agent] Invalid event IDs");
      return { processed: false };
    }

    const blog = await step.run("load-blog", async () => {
      return convex.query(api.blogs.getByIdForCron, {
        blogId: validBlogId,
        cronKey,
      });
    });

    if (!blog) return { processed: false };
    if (blog.workspaceId !== validWorkspaceId) {
      console.error("[links-agent] Blog/workspace mismatch");
      return { processed: false };
    }

    const payload = await step.run("analyze-links", async () => {
      return analyzeInternalLinks(
        convex,
        validWorkspaceId,
        {
          _id: blog._id,
          title: blog.title,
          content: blog.content,
          focusKeyword: blog.focusKeyword ?? focusKeyword,
        },
        { cronKey }
      );
    });

    if (!payload || payload.suggestions.length === 0) {
      return { processed: true, suggestions: 0 };
    }

    await step.run("create-action", async () => {
      await convex.mutation(api.agentActions.createForCron, {
        workspaceId: validWorkspaceId,
        agentType: "internal_links",
        payload,
        reasoning: `Found ${payload.suggestions.length} internal linking opportunities for "${blog.title}"`,
        notificationTitle: "Internal Links Suggested",
        notificationBody: `${payload.suggestions.length} link suggestions for "${blog.title}"`,
        cronKey,
      });
    });

    return { processed: true, suggestions: payload.suggestions.length };
  }
);
