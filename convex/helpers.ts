import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { ERR_UNAUTHENTICATED, ERR_UNAUTHORIZED } from "./errors";

/**
 * Asserts that the calling user is authenticated and owns the given workspace.
 * Throws "Unauthenticated" or "Unauthorized" so callers can propagate them as
 * 401/403 errors at the API layer.
 */
export async function requireWorkspaceAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"workspaces">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError(ERR_UNAUTHENTICATED);
  }

  const workspace = await ctx.db.get(workspaceId);
  if (!workspace || workspace.clerkUserId !== identity.subject) {
    throw new ConvexError(ERR_UNAUTHORIZED);
  }

  return workspace;
}
