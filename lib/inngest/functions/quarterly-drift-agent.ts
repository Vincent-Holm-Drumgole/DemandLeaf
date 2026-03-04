import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { analyzeStrategyDrift } from "@/lib/agents/strategy-drift-agent";

const MAX_WORKSPACES_PER_RUN = 500;
const DRIFT_COOLDOWN_MS = 80 * 24 * 60 * 60 * 1000; // 80 days

/**
 * Quarterly Strategy Drift Agent — fires 1st of Jan/Apr/Jul/Oct at 11:00 UTC.
 */
export const quarterlyDriftAgent = inngest.createFunction(
  { id: "quarterly-drift-agent", name: "Quarterly Strategy Drift Agent" },
  { cron: "0 11 1 */3 *" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[drift-agent] INNGEST_CRON_KEY not configured");
      return { processed: 0, actions: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () => {
      return convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      });
    });

    let actions = 0;
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    for (const workspace of workspaces) {
      const data = await step.run(`load-data-${workspace._id}`, async () => {
        const [strategies, blogs] = await Promise.all([
          convex.query(api.strategies.listByWorkspaceForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
          convex.query(api.blogs.listPublishedForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
        ]);
        return { strategies, blogs };
      });

      const activeStrategy = data.strategies.find(
        (s: { status: string; driftCheckedAt?: number }) => {
          if (s.status !== "active") return false;
          if (s.driftCheckedAt && now - s.driftCheckedAt < DRIFT_COOLDOWN_MS) return false;
          return true;
        }
      );
      if (!activeStrategy) continue;

      const moreData = await step.run(`load-keywords-${workspace._id}`, async () => {
        const [keywords, snapshots] = await Promise.all([
          convex.query(api.keywords.listByStrategyForCron, {
            strategyId: activeStrategy._id,
            workspaceId: workspace._id,
            cronKey,
          }),
          convex.query(api.rankSnapshots.getRecentForWorkspaceForCron, {
            workspaceId: workspace._id,
            since: ninetyDaysAgo,
            cronKey,
          }),
        ]);
        return { keywords, snapshots };
      });

      const payload = await step.run(`analyze-${workspace._id}`, async () => {
        return analyzeStrategyDrift({
          strategy: activeStrategy,
          keywords: moreData.keywords.map((k: {
            keyword: string;
            status: string;
            searchVolume?: number;
            opportunityScore?: number;
          }) => ({
            keyword: k.keyword,
            status: k.status,
            searchVolume: k.searchVolume,
            opportunityScore: k.opportunityScore,
          })),
          blogs: data.blogs.map((b: {
            focusKeyword?: string;
            archetype: string;
            seoScore?: number;
            publishedAt?: number;
          }) => ({
            focusKeyword: b.focusKeyword,
            archetype: b.archetype,
            seoScore: b.seoScore,
            publishedAt: b.publishedAt,
          })),
          rankSnapshots: moreData.snapshots.map((s: {
            keyword: string;
            position?: number | null;
          }) => ({
            keyword: s.keyword,
            position: s.position,
          })),
        });
      });

      if (!payload) continue;

      await step.run(`create-action-${workspace._id}`, async () => {
        await convex.mutation(api.agentActions.createForCron, {
          workspaceId: workspace._id,
          agentType: "strategy_drift",
          payload,
          reasoning: payload.digest,
          notificationTitle: "Strategy Health Check Complete",
          notificationBody: `${payload.pivotRecommendations.length} pivots recommended`,
          cronKey,
        });
      });

      actions++;
    }

    if (workspaces.length >= MAX_WORKSPACES_PER_RUN) {
      // TODO: Add cursor-based pagination to listAllForCron to process remaining workspaces
      console.warn(`[drift-agent] Hit workspace limit (${MAX_WORKSPACES_PER_RUN}), some workspaces may be skipped`);
    }

    return { processed: workspaces.length, actions };
  }
);
