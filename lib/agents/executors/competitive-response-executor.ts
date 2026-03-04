import { inngest } from "@/lib/inngest/client";
import type { CompetitiveResponsePayload } from "@/types";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Execute an approved competitive response action.
 *
 * STUB: Counts intended operations and fires coordination events,
 * but does not yet perform Convex mutations for brief creation/updates.
 * TODO: Wire up contentBriefs.create and contentBriefs.updateStatus mutations.
 */
export async function executeCompetitiveResponse(
  _convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  payload: CompetitiveResponsePayload
): Promise<{ created: number; updated: number; skipped: number; stubbed: true }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const newKeywords: string[] = [];

  for (const threat of payload.threats) {
    try {
      if (threat.action === "create_brief") {
        newKeywords.push(threat.keyword);
        created++;
      } else if (threat.action === "update_brief" && threat.targetBriefId) {
        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[competitive-executor] Failed for ${threat.keyword}:`, err);
      skipped++;
    }
  }

  // Fire coordination event
  if (newKeywords.length > 0) {
    inngest
      .send({
        name: "agent/competitive-response-applied",
        data: {
          workspaceId: workspaceId as string,
          strategyId: payload.strategyId,
          newBriefKeywords: newKeywords,
        },
      })
      .catch((err) => console.warn("[competitive-executor] inngest.send failed:", err));
  }

  return { created, updated, skipped, stubbed: true };
}
