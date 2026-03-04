import { api } from "@/convex/_generated/api";
import { inngest } from "@/lib/inngest/client";
import { parseConvexId } from "@/lib/convex-id";
import type { StrategyDriftPayload } from "@/types";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Execute an approved strategy drift action.
 * Updates strategy driftCheckedAt and fires coordination event.
 */
export async function executeStrategyDrift(
  convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  payload: StrategyDriftPayload
): Promise<{ updated: boolean }> {
  const strategyId = parseConvexId(payload.strategyId, "strategies");
  if (!strategyId) return { updated: false };

  try {
    await convex.mutation(api.strategies.updateDriftCheckedAt, {
      strategyId,
    });
  } catch (err) {
    console.error("[drift-executor] Failed to update driftCheckedAt:", err);
  }

  // Fire coordination event for Calendar Agent
  inngest
    .send({
      name: "agent/strategy-drift-applied",
      data: {
        workspaceId: workspaceId as string,
        strategyId: payload.strategyId,
        pivots: payload.pivotRecommendations.map((p) => ({
          type: p.type,
          recommendation: p.recommendation,
        })),
      },
    })
    .catch((err) => console.warn("[drift-executor] inngest.send failed:", err));

  return { updated: true };
}
