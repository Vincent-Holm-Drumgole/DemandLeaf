const DEFAULT_WORKSPACE_PATH = "/dashboard";

export function buildWorkspacePath(workspaceId: string, path = DEFAULT_WORKSPACE_PATH): string {
  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }
  const normalizedPath = normalizeWorkspaceSubpath(path);
  return `/w/${workspaceId}${normalizedPath}`;
}

export function buildWorkspaceApiUrl(apiPath: string, workspaceId: string): string {
  const url = new URL(apiPath, "http://localhost");
  url.searchParams.set("workspaceId", workspaceId);
  return `${url.pathname}${url.search}`;
}

export function normalizeWorkspaceSubpath(path: string): string {
  if (!path || path === "/") {
    return DEFAULT_WORKSPACE_PATH;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/w" ? DEFAULT_WORKSPACE_PATH : normalized;
}

export function getWorkspaceSubpath(pathname: string): string {
  const match = pathname.match(/^\/w\/[^/]+(\/.*)?$/);
  return normalizeWorkspaceSubpath(match?.[1] ?? DEFAULT_WORKSPACE_PATH);
}

export function replaceWorkspaceInPath(pathname: string, workspaceId: string): string {
  if (!pathname.startsWith("/w/")) {
    return buildWorkspacePath(workspaceId, pathname);
  }

  const segments = pathname.split("/");
  segments[2] = workspaceId;
  return segments.join("/");
}
