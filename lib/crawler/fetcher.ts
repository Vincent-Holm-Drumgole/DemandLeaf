const USER_AGENT =
  "DemandLeaf-Bot/1.0 (+https://demandleaf.com/bot)";

const PAGE_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

export interface FetchResult {
  html: string;
  url: string;
  status: number;
}

export interface FetchError {
  url: string;
  code: string;
  message: string;
}

export interface FetchPageOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  validateUrl?: (url: string) => boolean;
}

/**
 * Fetch a single URL with timeout, redirect following, and error handling.
 */
export async function fetchPage(
  url: string,
  options: FetchPageOptions = {}
): Promise<FetchResult | FetchError> {
  const timeoutMs = options.timeoutMs ?? PAGE_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;

  return fetchWithRedirects(url, {
    timeoutMs,
    maxRedirects,
    validateUrl: options.validateUrl,
    redirects: 0,
  });
}

interface FetchWithRedirectState {
  timeoutMs: number;
  maxRedirects: number;
  validateUrl?: (url: string) => boolean;
  redirects: number;
}

async function fetchWithRedirects(
  url: string,
  state: FetchWithRedirectState
): Promise<FetchResult | FetchError> {
  if (state.validateUrl && !state.validateUrl(url)) {
    return {
      url,
      code: "unsafe_url",
      message: "URL blocked by security policy",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), state.timeoutMs);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeout);

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return {
          url,
          code: "redirect_missing_location",
          message: "Redirect response missing Location header",
        };
      }

      if (state.redirects >= state.maxRedirects) {
        return {
          url,
          code: "too_many_redirects",
          message: `Exceeded max redirects (${state.maxRedirects})`,
        };
      }

      let redirectUrl: string;
      try {
        redirectUrl = new URL(location, url).href;
      } catch {
        return {
          url,
          code: "invalid_redirect_url",
          message: "Redirect target URL is invalid",
        };
      }

      return fetchWithRedirects(redirectUrl, {
        ...state,
        redirects: state.redirects + 1,
      });
    }

    if (!response.ok) {
      return {
        url,
        code: `http_${response.status}`,
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    return { html, url, status: response.status };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          url,
          code: "timeout",
          message: `Request timed out after ${state.timeoutMs}ms`,
        };
      }
      return { url, code: "fetch_error", message: error.message };
    }
    return { url, code: "unknown", message: "Unknown fetch error" };
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

/**
 * Type guard for successful fetch results.
 */
export function isFetchResult(
  result: FetchResult | FetchError
): result is FetchResult {
  return "html" in result;
}
