let activeWorkspaceId: string | null = null;
let nativeFetch: typeof window.fetch | null = null;

type FetchInput = RequestInfo | URL;

function resolveUrl(input: FetchInput): URL | null {
  if (typeof window === "undefined") return null;

  if (input instanceof Request) {
    return new URL(input.url, window.location.origin);
  }

  if (input instanceof URL) {
    return input;
  }

  return new URL(input, window.location.origin);
}

function withWorkspaceHeader(
  input: FetchInput,
  init?: RequestInit,
  workspaceId = activeWorkspaceId,
): [FetchInput, RequestInit | undefined] {
  if (!workspaceId || typeof window === "undefined") {
    return [input, init];
  }

  const url = resolveUrl(input);
  if (!url || url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
    return [input, init];
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    const initHeaders = new Headers(init.headers);
    initHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  if (!headers.has("x-workspace-id")) {
    headers.set("x-workspace-id", workspaceId);
  }

  if (input instanceof Request) {
    return [new Request(input, { headers }), init];
  }

  return [input, { ...init, headers }];
}

export function setActiveWorkspaceId(workspaceId: string | null) {
  activeWorkspaceId = workspaceId;
}

export function installWorkspaceFetch() {
  if (typeof window === "undefined" || nativeFetch) {
    return;
  }

  nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: FetchInput, init?: RequestInit) => {
    const [nextInput, nextInit] = withWorkspaceHeader(input, init);
    return nativeFetch!(nextInput, nextInit);
  }) as typeof window.fetch;
}

export function apiFetch(input: FetchInput, init?: RequestInit) {
  const [nextInput, nextInit] = withWorkspaceHeader(input, init);
  if (typeof window !== "undefined" && nativeFetch) {
    return nativeFetch(nextInput, nextInit);
  }
  return fetch(nextInput, nextInit);
}
