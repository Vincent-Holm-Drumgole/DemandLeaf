/**
 * Simple in-memory rate limiter for login attempts.
 * Tracks failed attempts per email address.
 * NOTE: resets on server restart and does not work across multiple instances.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, AttemptRecord>();

export function isRateLimited(email: string): boolean {
  const now = Date.now();
  const record = attempts.get(email);

  if (!record || now >= record.resetAt) {
    return false;
  }

  return record.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(email: string): void {
  const now = Date.now();
  const record = attempts.get(email);

  if (!record || now >= record.resetAt) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    record.count += 1;
  }
}

export function clearAttempts(email: string): void {
  attempts.delete(email);
}
