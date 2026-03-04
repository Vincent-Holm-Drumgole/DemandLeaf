import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import type { CalendarAgentPayload } from "@/types";

interface CalendarItem {
  _id: string;
  keywordId: string;
  scheduledDate: number;
  priority: number;
  archetype: string;
  status: string;
}

interface KeywordData {
  _id: string;
  keyword: string;
  opportunityScore?: number;
  searchVolume?: number;
}

/**
 * Analyze the content calendar and propose reprioritization.
 * Uses Haiku for classification, pure code for momentum scoring.
 */
export async function analyzeCalendar(input: {
  strategyId: string;
  calendarItems: CalendarItem[];
  keywords: KeywordData[];
}): Promise<CalendarAgentPayload | null> {
  const { strategyId, calendarItems, keywords } = input;

  if (calendarItems.length === 0) return null;

  // Build keyword lookup
  const keywordMap = new Map(keywords.map((k) => [k._id, k]));

  // Compute momentum scores (pure code)
  const itemsWithScores = calendarItems
    .filter((item) => item.status === "scheduled")
    .map((item) => {
      const kw = keywordMap.get(item.keywordId);
      const opportunityScore = kw?.opportunityScore ?? 50;
      return {
        calendarId: item._id,
        keyword: kw?.keyword ?? "unknown",
        currentScheduledDate: item.scheduledDate,
        currentPriority: item.priority,
        opportunityScore,
        searchVolume: kw?.searchVolume ?? 0,
      };
    });

  if (itemsWithScores.length === 0) return null;

  // Batch Haiku call for priority classification
  const system = `You are a content strategist. Given a list of scheduled content items with their keyword data, suggest priority adjustments.

For each item, decide: "up" (increase priority), "down" (decrease priority), or "keep" (no change).

Return JSON array: [{ "calendarId": string, "action": "up"|"down"|"keep", "proposedPriority": number, "rationale": string }]
Only include items where action is "up" or "down". Omit "keep" items.
Return ONLY the JSON array.`;

  const user = `Scheduled content items (next 60 days):
${itemsWithScores.map((item, i) => `${i + 1}. "${item.keyword}" — priority ${item.currentPriority}, opportunity score ${item.opportunityScore}, volume ${item.searchVolume}`).join("\n")}`;

  const result = await callHaiku(system, user, {
    maxTokens: 2048,
    temperature: 0.3,
  });

  let changes: Array<{
    calendarId: string;
    action: string;
    proposedPriority: number;
    rationale: string;
  }>;

  try {
    changes = parseJsonResponse<typeof changes>(result.content);
    if (!Array.isArray(changes)) return null;
  } catch {
    return null;
  }

  const proposedChanges = changes
    .filter((c) => c.action !== "keep")
    .map((change) => {
      const item = itemsWithScores.find((i) => i.calendarId === change.calendarId);
      return {
        calendarId: change.calendarId,
        keyword: item?.keyword ?? "unknown",
        currentScheduledDate: item?.currentScheduledDate ?? 0,
        proposedScheduledDate: item?.currentScheduledDate ?? 0,
        currentPriority: item?.currentPriority ?? 0,
        proposedPriority: change.proposedPriority,
        rationale: change.rationale,
      };
    })
    .slice(0, 10);

  if (proposedChanges.length === 0) return null;

  const digest = `## Calendar Reprioritization — ${proposedChanges.length} changes proposed

${proposedChanges.slice(0, 5).map((c) => `- **${c.keyword}**: priority ${c.currentPriority} → ${c.proposedPriority} — ${c.rationale}`).join("\n")}
${proposedChanges.length > 5 ? `\n...and ${proposedChanges.length - 5} more changes` : ""}`;

  return { strategyId, proposedChanges, digest };
}
