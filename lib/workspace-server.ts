import type { ConvexHttpClient } from "convex/browser";
import { cookies, headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { getAuthedConvexClient } from "@/lib/convex";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import { buildWorkspacePath, normalizeWorkspaceSubpath } from "@/lib/workspace-paths";

type ViewerWorkspace = Array<{ _id: string }>;

export async function listViewerWorkspaces(convex: ConvexHttpClient) {
  return convex.query(api.workspaces.listForViewer, {});
}

export async function getViewerWorkspaceById(
  convex: ConvexHttpClient,
  workspaceId: string,
) {
  const validWorkspaceId = parseConvexId(workspaceId, "workspaces");
  if (!validWorkspaceId) return null;

  return convex.query(api.workspaces.getByIdForViewer, { workspaceId: validWorkspaceId });
}

function findPreferredWorkspaceId(workspaces: ViewerWorkspace, rawWorkspaceId: string | undefined) {
  const preferredId = rawWorkspaceId ? parseConvexId(rawWorkspaceId, "workspaces") : null;
  if (preferredId && workspaces.some((workspace) => workspace._id === preferredId)) {
    return preferredId;
  }

  return workspaces[0]?._id ?? null;
}

export async function getPreferredWorkspaceRedirect(subpath = "/dashboard") {
  const { userId } = await auth();
  if (!userId) {
    return "/sign-in";
  }

  let convex: ConvexHttpClient;
  try {
    convex = await getAuthedConvexClient();
  } catch (err) {
    console.error("[workspace-server] failed to create authed Convex client:", err);
    return "/sign-in";
  }

  try {
    const workspaces = await listViewerWorkspaces(convex);
    if (workspaces.length === 0) {
      return "/onboarding";
    }

    const cookieStore = await cookies();
    const workspaceId = findPreferredWorkspaceId(
      workspaces,
      cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value,
    );
    if (!workspaceId) {
      return "/onboarding";
    }

    return buildWorkspacePath(workspaceId, normalizeWorkspaceSubpath(subpath));
  } catch (err) {
    console.error("[workspace-server] failed to resolve preferred workspace:", err);
  }

  try {
    const fallbackWorkspace = await convex.query(api.workspaces.getByClerkUser, {});
    if (fallbackWorkspace?._id) {
      return buildWorkspacePath(
        fallbackWorkspace._id,
        normalizeWorkspaceSubpath(subpath),
      );
    }
  } catch (err) {
    console.error("[workspace-server] failed to resolve fallback workspace:", err);
  }

  return "/onboarding";
}

function getWorkspaceIdFromRequestLike(
  requestLike?: Request | { headers: Headers; url?: string },
): string | undefined {
  const rawFromHeader = requestLike?.headers.get("x-workspace-id")?.trim();
  if (rawFromHeader) {
    return rawFromHeader;
  }

  if (requestLike?.url) {
    const url = new URL(requestLike.url);
    return url.searchParams.get("workspaceId")?.trim() || undefined;
  }

  return undefined;
}

export async function requireRequestWorkspace(
  convex: ConvexHttpClient,
  requestLike?: Request | { headers: Headers; url?: string },
) {
  const currentHeaders = requestLike?.headers ?? (await headers());
  const workspaceId =
    getWorkspaceIdFromRequestLike(requestLike) ??
    currentHeaders.get("x-workspace-id")?.trim() ??
    undefined;

  if (!workspaceId) {
    return null;
  }

  return getViewerWorkspaceById(convex, workspaceId);
}
