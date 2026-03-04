import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import type { DiagnosisResult, DiagnosisCause } from "@/types";

const VALID_CAUSES: DiagnosisCause[] = [
  "content_freshness",
  "serp_feature_loss",
  "competitor_improvement",
  "technical_issue",
  "intent_mismatch",
  "authority_gap",
];

interface DiagnoseInput {
  alertType: string;
  severity: string;
  deltaPercent: number;
  blogTitle: string;
  keyword: string;
  blogAgeDays: number;
  wordCount: number;
  rankHistory: Array<{ date: string; position: number | null }>;
  performanceHistory: Array<{
    date: string;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
  }>;
  serpTop5: Array<{ position: number; title: string; snippet: string }>;
}

/**
 * Use Haiku to classify the primary cause of underperformance.
 * Cost: ~$0.0007 per diagnosis (~700 total tokens).
 */
export async function diagnoseCause(
  input: DiagnoseInput
): Promise<DiagnosisResult> {
  const system = `You are an SEO analyst specializing in content performance diagnosis.
Classify the PRIMARY cause of underperformance from these 6 categories:
- content_freshness: outdated information, stale statistics
- serp_feature_loss: lost a featured snippet or SERP feature
- competitor_improvement: new/improved competitor content outranking
- technical_issue: thin content, missing internal links, poor structure
- intent_mismatch: content type doesn't match current search intent
- authority_gap: insufficient backlinks/domain authority vs competitors

Return JSON: { "cause": "<one of 6 values>", "confidence": "high"|"medium"|"low", "notes": "<1-3 sentence explanation>", "topActions": ["<action 1>", "<action 2>", "<action 3>"] }
Return ONLY the JSON object, nothing else.`;

  const rankHistoryStr = input.rankHistory
    .slice(0, 8)
    .map((r) => `${r.date}: position ${r.position ?? "not ranking"}`)
    .join("\n");

  const perfHistoryStr = input.performanceHistory
    .slice(0, 8)
    .map(
      (p) =>
        `${p.date}: clicks=${p.clicks ?? "?"} impressions=${p.impressions ?? "?"} ctr=${p.ctr != null ? (p.ctr * 100).toFixed(1) + "%" : "?"}`
    )
    .join("\n");

  const serpStr = input.serpTop5
    .map((s) => `${s.position}. ${s.title} — ${s.snippet.slice(0, 100)}`)
    .join("\n");

  const user = `<blog_signals>
Title: ${input.blogTitle}
Keyword: ${input.keyword}
Published: ${input.blogAgeDays} days ago
Word count: ${input.wordCount}
Alert: ${input.alertType} severity=${input.severity} delta=${input.deltaPercent}%
</blog_signals>

<rank_history>
${rankHistoryStr || "No rank data available"}
</rank_history>

<performance_history>
${perfHistoryStr || "No performance data available"}
</performance_history>

<current_serp_top5>
${serpStr || "No SERP data available"}
</current_serp_top5>`;

  const result = await callHaiku(system, user, {
    maxTokens: 512,
    temperature: 0.3,
  });

  try {
    const parsed = parseJsonResponse<DiagnosisResult>(result.content);
    if (!VALID_CAUSES.includes(parsed.cause)) {
      parsed.cause = "content_freshness";
    }
    return parsed;
  } catch {
    return {
      cause: "content_freshness",
      confidence: "low",
      notes: "Unable to determine specific cause. Defaulting to content freshness review.",
      topActions: [
        "Review content for outdated information",
        "Check competitor content for improvements",
        "Verify internal linking structure",
      ],
    };
  }
}
