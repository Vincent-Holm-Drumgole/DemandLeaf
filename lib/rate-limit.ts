/**
 * Lightweight in-memory sliding-window rate limiter (per IP).
 *
 * Suitable for single-instance deployments (local dev, single Vercel region).
 * Swap the store for @upstash/ratelimit + Redis for multi-instance production.
 */

interface RateLimitOptions {
  /** Maximum requests allowed within the window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
}

interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the oldest slot expires */
  resetAt: number;
}

// Map<key, sorted list of request timestamps (ms)>
const store = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  { limit, windowSec }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const cutoff = now - windowMs;

  const timestamps = (store.get(key) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  store.set(key, timestamps);

  const count = timestamps.length;
  const allowed = count <= limit;
  const resetAt = timestamps[0] + windowMs;

  return {
    allowed,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

/**
 * Extract a best-effort client IP from the request.
 * Prefers X-Forwarded-For (set by Vercel / proxies), falls back to a constant
 * so that local development without a proxy still works.
 */
export function getClientIp(request: Request): string {
  const xff = (request.headers as Headers).get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "127.0.0.1";
}
