/**
 * Distributed rate limiter.
 *
 * Uses Upstash Redis (sliding-window) when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set — consistent across all serverless
 * instances and cold starts.
 *
 * Falls back to an in-memory sliding-window implementation when those env
 * vars are absent (local development, CI without secrets), or if Upstash
 * throws a transient error (network blip, timeout, auth failure). The
 * in-memory store is per-process and will not be shared across instances.
 *
 * All call sites must `await checkRateLimit(…)`.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitOptions {
  /** Maximum requests allowed within the window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the current window resets */
  resetAt: number;
}

// ── Upstash path ──────────────────────────────────────────────────────────────

let redis: Redis | null = null;

/** Lazily initialised; throws if called without env vars set. */
function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

// Cache one Ratelimit instance per (limit, windowSec) combination so we
// don't recreate it on every request (each instance holds an ephemeralCache).
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowSec: number): Ratelimit {
  const key = `${limit}:${windowSec}`;
  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis: getRedis(),
        // Matches the sliding-window semantics of the in-memory fallback.
        limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
        // Reduces Redis RTTs for the same key within a single invocation.
        ephemeralCache: new Map(),
      })
    );
  }
  return limiters.get(key)!;
}

async function checkUpstash(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const limiter = getLimiter(options.limit, options.windowSec);
  const { success, remaining, reset } = await limiter.limit(key);
  return { allowed: success, remaining, resetAt: reset };
}

// ── In-memory fallback ────────────────────────────────────────────────────────

// Map<key, sorted list of request timestamps (ms)>
const store = new Map<string, number[]>();

// Evict stale keys every 5 minutes to prevent unbounded growth from unique IPs.
// .unref() ensures this timer doesn't block Node from exiting in tests/dev.
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, timestamps] of store) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function checkInMemory(
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

  return { allowed, remaining: Math.max(0, limit - count), resetAt };
}

// ── Public API ────────────────────────────────────────────────────────────────

const upstashConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  if (upstashConfigured) {
    try {
      return await checkUpstash(key, options);
    } catch (err) {
      console.error("[rate-limit] Upstash error, falling back to in-memory:", err);
      return checkInMemory(key, options);
    }
  }
  return checkInMemory(key, options);
}

/**
 * Extract a best-effort client IP from the request.
 * Prefers X-Forwarded-For (set by Vercel / proxies), falls back to a
 * loopback address so that local development without a proxy still works.
 */
export function getClientIp(request: Request): string {
  const xff = (request.headers as Headers).get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "127.0.0.1";
}
