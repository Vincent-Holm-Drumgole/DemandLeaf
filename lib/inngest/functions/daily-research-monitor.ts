import { inngest } from "../client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import {
  buildResearchBrief,
  buildTrendReportBrief,
  fetchResearchSourceItems,
  scoreResearchItem,
} from "@/lib/research/monitor";

const MAX_WORKSPACES_PER_RUN = 500;
const RELEVANCE_THRESHOLD = 25;

export const dailyResearchMonitor = inngest.createFunction(
  { id: "daily-research-monitor", name: "Daily Research Monitor" },
  { cron: "0 11 * * *" },
  async ({ step }) => {
    const convex = getConvexClient();
    const cronKey = process.env.INNGEST_CRON_KEY;
    if (!cronKey) {
      console.error("[research-monitor] INNGEST_CRON_KEY not configured");
      return { processed: 0, created: 0 };
    }

    const workspaces = await step.run("list-workspaces", async () =>
      convex.query(api.workspaces.listAllForCron, {
        cronKey,
        limit: MAX_WORKSPACES_PER_RUN,
      }),
    );

    let created = 0;

    for (const workspace of workspaces) {
      const researchState = await step.run(
        `load-research-state-${workspace._id}`,
        async () => {
          const [loadedSources, loadedStrategies, loadedKbEntries, loadedCompetitors, briefs] = await Promise.all([
            convex.query(api.research.listSourcesForCron, {
              workspaceId: workspace._id,
              cronKey,
            }),
            convex.query(api.strategies.listByWorkspaceForCron, {
              workspaceId: workspace._id,
              cronKey,
            }),
            convex.query(api.knowledgeBase.listReadyByWorkspaceForCron, {
              workspaceId: workspace._id,
              cronKey,
            }),
            convex.query(api.competitorTracking.listByWorkspaceForCron, {
              workspaceId: workspace._id,
              cronKey,
            }),
            convex.query(api.research.listBriefsForCron, {
              workspaceId: workspace._id,
              cronKey,
            }),
          ]);
          return {
            sources: loadedSources,
            strategies: loadedStrategies,
            kbEntries: loadedKbEntries,
            competitorTracking: loadedCompetitors,
            existingBriefs: briefs,
          };
        },
      );
      const {
        sources,
        strategies,
        kbEntries,
        competitorTracking,
        existingBriefs,
      } = researchState;

      const activeStrategy = strategies.find((strategy: { status: string }) => strategy.status === "active");
      const strategyKeywords = activeStrategy
        ? await step.run(`load-strategy-keywords-${workspace._id}`, async () => {
            const keywords = await convex.query(api.keywords.listByStrategyForCron, {
              strategyId: activeStrategy._id,
              workspaceId: workspace._id,
              cronKey,
            });
            return keywords.map((keyword: { keyword: string }) => keyword.keyword);
          })
        : [];

      const signals = {
        keywords: strategyKeywords,
        clusterTerms: activeStrategy?.seedKeywords ?? [],
        kbTags: kbEntries.flatMap((entry: { tags: string[] }) => entry.tags),
      };

      for (const source of sources.filter((item: { status: string }) => item.status === "active")) {
        try {
          const items = await step.run(`fetch-source-${source._id}`, async () =>
            fetchResearchSourceItems({
              type: source.type,
              url: source.url,
              label: source.label,
            }),
          );
          const topMatches = items
            .map((item) => ({ item, score: scoreResearchItem(item, signals) }))
            .filter((item) => item.score >= RELEVANCE_THRESHOLD)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

          for (const match of topMatches) {
            if (existingBriefs.some((brief: { title: string }) => brief.title === match.item.title)) {
              continue;
            }
            const brief = buildResearchBrief(match.item, match.score);
            await step.run(`create-brief-${source._id}-${match.item.title}`, async () =>
              convex.mutation(api.research.createBriefForCron, {
                workspaceId: workspace._id,
                sourceId: source._id,
                title: brief.title,
                summary: brief.summary,
                whyItMatters: brief.whyItMatters,
                suggestedAngle: brief.suggestedAngle,
                sourceUrls: brief.sourceUrls,
                sourceNames: brief.sourceNames,
                keywords: brief.keywords,
                relevanceScore: brief.relevanceScore,
                kind: "daily_brief",
                notificationType: "research_brief_ready",
                cronKey,
              }),
            );
            created += 1;
          }

          await step.run(`mark-source-healthy-${source._id}`, async () =>
            convex.mutation(api.research.updateSourceCheckForCron, {
              sourceId: source._id,
              status: "active",
              cronKey,
            }),
          );
        } catch (err) {
          await step.run(`mark-source-error-${source._id}`, async () =>
            convex.mutation(api.research.updateSourceCheckForCron, {
              sourceId: source._id,
              status: "error",
              errorMessage: err instanceof Error ? err.message : "Source monitoring failed",
              cronKey,
            }),
          );
        }
      }

      for (const competitor of competitorTracking) {
        const sourceUrl = competitor.domain.startsWith("http")
          ? competitor.domain
          : `https://${competitor.domain}`;
        try {
          const items = await step.run(`fetch-competitor-${competitor._id}`, async () =>
            fetchResearchSourceItems({
              type: "url",
              url: sourceUrl,
              label: competitor.domain,
            }),
          );
          const topItems = items.slice(0, 3);
          for (const item of topItems) {
            await step.run(`save-competitor-article-${competitor._id}-${item.url}`, async () =>
              convex.mutation(api.research.recordCompetitorArticleForCron, {
                workspaceId: workspace._id,
                trackingId: competitor._id,
                domain: competitor.domain,
                url: item.url,
                title: item.title,
                summary: item.summary,
                angle: item.summary,
                keywords: competitor.trackedKeywords,
                publishedAt: item.publishedAt,
                cronKey,
              }),
            );
          }
        } catch (err) {
          console.warn("[research-monitor] competitor fetch failed", competitor.domain, err);
        }
      }

      if (new Date().getUTCDate() === 1) {
        const recentBriefs = existingBriefs
          .filter((brief: { kind: string; createdAt: number }) =>
            brief.kind === "daily_brief" && brief.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000,
          )
          .slice(0, 5)
          .map((brief: {
            title: string;
            summary: string;
            sourceUrls: string[];
            sourceNames: string[];
          }) => ({
            title: brief.title,
            summary: brief.summary,
            url: brief.sourceUrls[0] ?? workspace.url ?? "https://app.demandleaf.io",
            sourceName: brief.sourceNames[0] ?? "Research monitor",
          }));

        if (recentBriefs.length >= 3) {
          const trendReport = buildTrendReportBrief(recentBriefs);
          await step.run(`create-trend-report-${workspace._id}`, async () =>
            convex.mutation(api.research.createBriefForCron, {
              workspaceId: workspace._id,
              title: trendReport.title,
              summary: trendReport.summary,
              whyItMatters: trendReport.whyItMatters,
              suggestedAngle: trendReport.suggestedAngle,
              sourceUrls: trendReport.sourceUrls,
              sourceNames: trendReport.sourceNames,
              keywords: trendReport.keywords,
              relevanceScore: trendReport.relevanceScore,
              kind: "trend_report",
              notificationType: "trend_report_ready",
              cronKey,
            }),
          );
        }
      }
    }

    return { processed: workspaces.length, created };
  },
);
