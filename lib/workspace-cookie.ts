export const ACTIVE_WORKSPACE_COOKIE = "dl_last_workspace";
export const ACTIVE_WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function createActiveWorkspaceCookie(workspaceId: string) {
  return {
    name: ACTIVE_WORKSPACE_COOKIE,
    value: encodeURIComponent(workspaceId),
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: ACTIVE_WORKSPACE_COOKIE_MAX_AGE,
  };
}

export function createClearedActiveWorkspaceCookie() {
  return {
    name: ACTIVE_WORKSPACE_COOKIE,
    value: "",
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export function readActiveWorkspaceCookie() {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${ACTIVE_WORKSPACE_COOKIE}=`;
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}
