import { ConvexError } from "convex/values";

/**
 * Returns true when `err` is a ConvexError whose data equals `code` exactly.
 *
 * Usage in API route handlers:
 *   if (isConvexAppError(err, ERR_BRIEF_NOT_FOUND)) { ... }
 *
 * Convex mutations should throw `new ConvexError(ERR_CODE)` (not `new Error`)
 * so the data survives serialization and can be matched here without fragile
 * substring checks.
 */
export function isConvexAppError(err: unknown, code: string): boolean {
  return err instanceof ConvexError && err.data === code;
}

/**
 * Best-effort error code matcher for API handlers.
 *
 * Prefers structured ConvexError matching and falls back to word-boundary
 * matching on error.message for legacy throw sites that still use Error.
 */
export function hasConvexErrorCode(err: unknown, code: string): boolean {
  if (isConvexAppError(err, code)) return true;
  if (!(err instanceof Error)) return false;

  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\b)${escapedCode}(\\b|$)`);
  return pattern.test(err.message);
}
