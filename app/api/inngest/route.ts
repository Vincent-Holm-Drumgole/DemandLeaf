import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { weeklyRankCheck } from "@/lib/inngest/functions/weekly-rank-check";
import { dailyDecayScan } from "@/lib/inngest/functions/daily-decay-scan";
import { dailyMetricsSync } from "@/lib/inngest/functions/daily-metrics-sync";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [weeklyRankCheck, dailyDecayScan, dailyMetricsSync],
});
