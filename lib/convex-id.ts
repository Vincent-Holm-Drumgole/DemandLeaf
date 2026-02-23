/**
 * Safely casts a raw route parameter string to a typed Convex ID.
 *
 * Convex IDs are opaque — the format is intentionally undocumented and should
 * not be parsed or regex-validated by application code (Convex docs). The
 * authoritative format check happens on the Convex server via the `v.id()`
 * validator attached to every query/mutation argument.
 *
 * This function performs only a client-side sanity check:
 *   - Rejects empty strings (URL params that were somehow empty)
 *   - Rejects strings that are implausibly long (>100 chars), guarding against
 *     oversized inputs being forwarded to Convex
 *
 * The `table` parameter lets TypeScript infer the correct `Id<T>` return type
 * at the call site:
 *
 *   const blogId = parseConvexId(rawId, "blogs"); // Id<"blogs"> | null
 */

import type { TableNames } from "@/convex/_generated/dataModel";
import type { Id } from "@/convex/_generated/dataModel";

export function parseConvexId<T extends TableNames>(
  value: string,
  table: T
): Id<T> | null {
  if (!table || !value || value.length > 100 || value.trim() !== value) return null;
  return value as Id<T>;
}
