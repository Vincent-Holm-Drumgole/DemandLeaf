import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import type { CalendarAgentPayload } from "@/types";
import type { ConvexHttpClient } from "convex/browser";

/**
 * Execute an approved calendar reprioritization.
 * Called synchronously from the approval API route.
 */
export async function executeCalendarChanges(
  convex: ConvexHttpClient,
  payload: CalendarAgentPayload
): Promise<{ applied: number; skipped: number }> {
  let applied = 0;
  let skipped = 0;

  for (const change of payload.proposedChanges) {
    const calendarId = parseConvexId(change.calendarId, "contentCalendar");
    if (!calendarId) {
      skipped++;
      continue;
    }

    try {
      await convex.mutation(api.contentCalendar.reschedule, {
        calendarId,
        scheduledDate: change.proposedScheduledDate,
        priority: change.proposedPriority,
      });
      applied++;
    } catch (err) {
      console.error(`[calendar-executor] Failed to reschedule ${change.calendarId}:`, err);
      skipped++;
    }
  }

  return { applied, skipped };
}
