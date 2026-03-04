import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
// Phase 6: Post-Publish Intelligence
import { weeklyRankCheck } from "@/lib/inngest/functions/weekly-rank-check";
import { dailyDecayScan } from "@/lib/inngest/functions/daily-decay-scan";
import { dailyMetricsSync } from "@/lib/inngest/functions/daily-metrics-sync";
// Phase 7: Agentic Operations v1
import { weeklyCalendarAgent } from "@/lib/inngest/functions/weekly-calendar-agent";
import { dailyRefreshAgent } from "@/lib/inngest/functions/daily-refresh-agent";
import { blogPublishedLinksAgent } from "@/lib/inngest/functions/blog-published-links-agent";
// Phase 8: Agentic Operations v2
import { weeklyCompetitiveAgent } from "@/lib/inngest/functions/weekly-competitive-agent";
import { quarterlyDriftAgent } from "@/lib/inngest/functions/quarterly-drift-agent";
import { dailyPublishingAgent } from "@/lib/inngest/functions/daily-publishing-agent";
// Phase 8: Agent Coordination
import { onStrategyDriftApplied } from "@/lib/inngest/functions/on-strategy-drift-applied";
import { onCompetitiveResponseApplied } from "@/lib/inngest/functions/on-competitive-response-applied";
import { onBlogPublishedAutonomously } from "@/lib/inngest/functions/on-blog-published-autonomously";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Phase 6
    weeklyRankCheck,
    dailyDecayScan,
    dailyMetricsSync,
    // Phase 7
    weeklyCalendarAgent,
    dailyRefreshAgent,
    blogPublishedLinksAgent,
    // Phase 8
    weeklyCompetitiveAgent,
    quarterlyDriftAgent,
    dailyPublishingAgent,
    // Phase 8 coordination
    onStrategyDriftApplied,
    onCompetitiveResponseApplied,
    onBlogPublishedAutonomously,
  ],
});
