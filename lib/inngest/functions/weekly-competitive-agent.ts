import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { analyzeCompetitorThreats } from "@/lib/agents/competitive-response-agent";

const MAX_WORKSPACES_PER_RUN = 500;

/**
 * Weekly Competitive Response Agent — fires Tuesday 08:00 UTC.
 * Monitors competitor SERP positions for tracked keywords.
 */
export const weeklyCompetitiveAgent = inngest.createFunction(
  { id: "weekly-competitive-agent", name: "Weekly Competitive Response Agent" },
  { cron: "0 8 * * 2" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[competitive-agent] INNGEST_CRON_KEY not configured");
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
        const [competitors, strategies] = await Promise.all([
          convex.query(api.competitorTracking.listByWorkspaceForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
          convex.query(api.strategies.listByWorkspaceForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
        ]);
        return { competitors, strategies };
      });

      if (data.competitors.length === 0) continue;

      const activeStrategy = data.strategies.find(
        (s: { status: string }) => s.status === "active"
      );
      if (!activeStrategy) continue;

      const coverage = await step.run(`load-coverage-${workspace._id}`, async () => {
        const [briefs, blogs] = await Promise.all([
          convex.query(api.contentBriefs.listByStrategyForCron, {
            strategyId: activeStrategy._id,
            workspaceId: workspace._id,
            cronKey,
          }),
          convex.query(api.blogs.listPublishedForCron, {
            workspaceId: workspace._id,
            cronKey,
          }),
        ]);
        return { briefs, blogs };
      });

      const existingCoverage = data.competitors
        .flatMap((c: { trackedKeywords: string[] }) => c.trackedKeywords)
        .filter((kw: string, i: number, arr: string[]) => arr.indexOf(kw) === i)
        .map((keyword: string) => {
          const brief = coverage.briefs.find(
            (b: { briefData: { targetKeyword: string }; _id: string }) =>
              b.briefData.targetKeyword.toLowerCase() === keyword.toLowerCase()
          );
          const blog = coverage.blogs.find(
            (b: { focusKeyword?: string }) =>
              b.focusKeyword?.toLowerCase() === keyword.toLowerCase()
          );
          return {
            keyword,
            hasBrief: !!brief,
            hasBlog: !!blog,
            briefId: brief?._id,
          };
        });

      const payload = await step.run(`analyze-${workspace._id}`, async () => {
        return analyzeCompetitorThreats(
          convex,
          activeStrategy._id,
          data.competitors.map((c: { domain: string; trackedKeywords: string[] }) => ({
            domain: c.domain,
            trackedKeywords: c.trackedKeywords,
          })),
          existingCoverage
        );
      });

      if (!payload) continue;

      await step.run(`create-action-${workspace._id}`, async () => {
        await convex.mutation(api.agentActions.createForCron, {
          workspaceId: workspace._id,
          agentType: "competitive_response",
          payload,
          reasoning: payload.digest,
          notificationTitle: "Competitive Threats Detected",
          notificationBody: `${payload.threats.length} competitor threats found`,
          cronKey,
        });

        // Update lastCheckedAt on all tracked competitors
        for (const competitor of data.competitors) {
          await convex.mutation(api.competitorTracking.updateLastChecked, {
            trackingId: competitor._id,
            cronKey,
          });
        }
      });

      actions++;
    }

    return { processed: workspaces.length, actions };
  }
);
