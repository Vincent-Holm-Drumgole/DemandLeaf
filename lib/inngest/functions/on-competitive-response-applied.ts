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
    if (!cronKey) {
      console.error("[competitive-coord] INNGEST_CRON_KEY not configured");
      return { added: 0 };
    }

    const data = event.data as Record<string, unknown> | undefined;
    const workspaceIdRaw =
      typeof data?.workspaceId === "string" ? data.workspaceId : null;
    const strategyIdRaw =
      typeof data?.strategyId === "string" ? data.strategyId : null;
    if (!workspaceIdRaw || !strategyIdRaw) {
      console.warn("[competitive-coord] Missing required event data. workspaceId:", typeof data?.workspaceId, "strategyId:", typeof data?.strategyId);
      return { added: 0 };
    }
    const newBriefKeywords = Array.isArray(data?.newBriefKeywords)
      ? data.newBriefKeywords.filter(
          (keyword): keyword is string =>
            typeof keyword === "string" && keyword.trim().length > 0
        )
      : [];

    if (newBriefKeywords.length === 0) return { added: 0 };

    const validWorkspaceId = parseConvexId(workspaceIdRaw, "workspaces");
    const validStrategyId = parseConvexId(strategyIdRaw, "strategies");
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

    // Add new keywords — one step per keyword for idempotent retries
    let added = 0;
    for (const keyword of newKeywords.slice(0, 10)) {
      const result = await step.run(`add-keyword-${keyword}`, async () => {
        try {
          await convex.mutation(api.keywords.createForCron, {
            workspaceId: validWorkspaceId,
            strategyId: validStrategyId,
            keyword,
            cronKey,
          });
          return true;
        } catch (err) {
          console.error(
            `[competitive-coord] Failed to add keyword "${keyword}" for workspace=${workspaceIdRaw} strategy=${strategyIdRaw}:`,
            err
          );
          return false;
        }
      });
      if (result) added++;
    }

    return { added };
  }
);
