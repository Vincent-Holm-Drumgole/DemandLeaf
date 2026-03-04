import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import type { RefreshAgentPayload } from "@/types";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Execute an approved refresh action.
 * Creates refreshHistory records and updates alert statuses.
 * Full Sonnet draft generation stays user-initiated from the refresh UI.
 */
export async function executeRefresh(
  convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  payload: RefreshAgentPayload
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const item of payload.alerts) {
    const blogId = parseConvexId(item.blogId, "blogs");
    if (!blogId) {
      skipped++;
      continue;
    }

    try {
      const parsedAlertId = item.alertId
        ? parseConvexId(item.alertId, "decayAlerts")
        : undefined;

      const refreshId = await convex.mutation(api.refreshHistory.create, {
        workspaceId,
        blogId,
        alertId: parsedAlertId ?? undefined,
        briefData: item.briefData,
        status: "pending",
      });

      // Update alert status to "refreshing" if there's a linked alert
      if (parsedAlertId) {
        await convex.mutation(api.decayAlerts.updateStatus, {
          alertId: parsedAlertId,
          status: "refreshing",
          refreshHistoryId: refreshId,
        });
      }

      created++;
    } catch (err) {
      console.error(`[refresh-executor] Failed for blog ${item.blogId}:`, err);
      skipped++;
    }
  }

  return { created, skipped };
}
