import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { ERR_UNAUTHENTICATED, ERR_UNAUTHORIZED } from "./errors";

async function requireViewerIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<{ clerkUserId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError(ERR_UNAUTHENTICATED);
  }
  return { clerkUserId: identity.subject };
}

export async function getWorkspaceAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<{ workspace: Doc<"workspaces">; role: "owner" | "admin" | "member" }> {
  const { clerkUserId } = await requireViewerIdentity(ctx);

  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    throw new ConvexError(ERR_UNAUTHORIZED);
  }

  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("clerkUserId", clerkUserId),
    )
    .unique();

  if (membership) {
    return { workspace, role: membership.role };
  }

  // Legacy owner-field fallback until every existing workspace is backfilled.
  if (workspace.clerkUserId === clerkUserId) {
    return { workspace, role: "owner" };
  }

  throw new ConvexError(ERR_UNAUTHORIZED);
}

/**
 * Asserts that the calling user is authenticated and owns the given workspace.
 * Throws "Unauthenticated" or "Unauthorized" so callers can propagate them as
 * 401/403 errors at the API layer.
 */
export async function requireWorkspaceAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"workspaces">> {
  const { workspace } = await getWorkspaceAccess(ctx, workspaceId);
  return workspace;
}

export async function requireWorkspaceAdminAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"workspaces">> {
  const { workspace, role } = await getWorkspaceAccess(ctx, workspaceId);
  if (role !== "owner" && role !== "admin") {
    throw new ConvexError(ERR_UNAUTHORIZED);
  }
  return workspace;
}

/**
 * Asserts that a server-side cron/admin key matches the configured secret.
 * Used by background jobs (Inngest) that execute without end-user identity.
 */
export function requireCronAccess(providedKey: string): void {
  const expected = process.env.INNGEST_CRON_KEY;
  if (!expected || providedKey !== expected) {
    throw new ConvexError(ERR_UNAUTHORIZED);
  }
}
