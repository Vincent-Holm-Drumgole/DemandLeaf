import { generateRefreshBrief } from "@/lib/refresh/generator";
import type { DiagnosisCause, RefreshAgentPayload } from "@/types";
import type { ConvexHttpClient } from "convex/browser";

const MAX_BRIEFS_PER_WORKSPACE = 5;
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

const VALID_CAUSES = new Set<DiagnosisCause>([
  "content_freshness",
  "serp_feature_loss",
  "competitor_improvement",
  "technical_issue",
  "intent_mismatch",
  "authority_gap",
]);

interface BlogData {
  _id: string;
  title: string;
  content: string;
  focusKeyword: string;
  wordCount?: number;
  publishedAt?: number;
}

interface AlertData {
  _id: string;
  blogId: string;
  alertType: string;
  severity: string;
  diagnosisCause?: string;
  diagnosisNotes?: string;
}

/**
 * Analyze published blogs for refresh needs.
 * Thresholds: open critical decay alerts OR 12+ months since publish.
 * Caps at 5 briefs/workspace/day to control Sonnet cost.
 */
export async function analyzeRefreshNeeds(
  convex: ConvexHttpClient,
  blogs: BlogData[],
  alerts: AlertData[]
): Promise<RefreshAgentPayload | null> {
  const now = Date.now();
  const flagged: Array<{ blog: BlogData; alert?: AlertData; reason: string }> = [];

  // 1. Blogs with critical decay alerts
  for (const alert of alerts) {
    if (alert.severity !== "critical") continue;
    const blog = blogs.find((b) => b._id === alert.blogId);
    if (!blog) continue;
    flagged.push({ blog, alert, reason: alert.alertType });
  }

  // 2. Blogs older than 12 months with no recent alert (freshness threshold)
  for (const blog of blogs) {
    if (!blog.publishedAt) continue;
    if (now - blog.publishedAt < TWELVE_MONTHS_MS) continue;
    if (flagged.some((f) => f.blog._id === blog._id)) continue;
    flagged.push({ blog, reason: "stale_content" });
  }

  if (flagged.length === 0) return null;

  const toProcess = flagged.slice(0, MAX_BRIEFS_PER_WORKSPACE);
  const payloadAlerts: RefreshAgentPayload["alerts"] = [];

  for (const { blog, alert, reason } of toProcess) {
    try {
      const briefData = await generateRefreshBrief(
        convex,
        {
          title: blog.title,
          content: blog.content,
          focusKeyword: blog.focusKeyword,
          wordCount: blog.wordCount ?? 0,
          publishedAt: blog.publishedAt,
        },
        {
          cause: (alert?.diagnosisCause && VALID_CAUSES.has(alert.diagnosisCause as DiagnosisCause)
            ? (alert.diagnosisCause as DiagnosisCause)
            : "content_freshness"),
          notes: alert?.diagnosisNotes ?? `Flagged for: ${reason}`,
        },
        null,
        ""
      );

      payloadAlerts.push({
        alertId: alert?._id ?? null,
        blogId: blog._id,
        blogTitle: blog.title,
        alertType: alert?.alertType ?? "stale_content",
        severity: alert?.severity ?? "warning",
        briefData,
        estimatedReworkPercent: briefData.estimatedReworkPercent,
      });
    } catch (err) {
      console.error(`[refresh-agent] Brief generation failed for ${blog._id}:`, err);
    }
  }

  if (payloadAlerts.length === 0) return null;
  return { alerts: payloadAlerts };
}
