import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

/**
 * Coordination: Competitive Response → Keywords.
 * When competitive threats are addressed, add new keywords to the strategy.
 */
export const onCompetitiveResponseApplied = inngest.createFunction(
  { id: "on-competitive-response-applied", name: "Competitive → Keywords Coordination" },
  { event: "agent/competitive-response-applied" },
  async ({ event, step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) return { added: 0 };

    const { workspaceId, strategyId, newBriefKeywords } = event.data as {
      workspaceId: string;
      strategyId: string;
      newBriefKeywords: string[];
    };

    if (!newBriefKeywords || newBriefKeywords.length === 0) return { added: 0 };

    const validWorkspaceId = parseConvexId(workspaceId, "workspaces");
    const validStrategyId = parseConvexId(strategyId, "strategies");
    if (!validWorkspaceId || !validStrategyId) return { added: 0 };

    // Check which keywords already exist
    const existingKeywords = await step.run("check-existing", async () => {
      return convex.query(api.keywords.listByStrategyForCron, {
        strategyId: validStrategyId,
        workspaceId: validWorkspaceId,
        cronKey,
      });
    });

    const existingSet = new Set(
      existingKeywords.map((k: { keyword: string }) => k.keyword.toLowerCase())
    );

    const newKeywords = newBriefKeywords.filter(
      (kw) => !existingSet.has(kw.toLowerCase())
    );

    if (newKeywords.length === 0) return { added: 0 };

    // Add new keywords via batch
    const added = await step.run("add-keywords", async () => {
      let count = 0;
      for (const keyword of newKeywords.slice(0, 10)) {
        try {
          await convex.mutation(api.keywords.createForCron, {
            workspaceId: validWorkspaceId,
            strategyId: validStrategyId,
            keyword,
            cronKey,
          });
          count++;
        } catch (err) {
          console.error(`[competitive-coord] Failed to add keyword "${keyword}":`, err);
        }
      }
      return count;
    });

    return { added };
  }
);
