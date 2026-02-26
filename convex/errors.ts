/**
 * Shared error message tokens used by Convex mutations and matched by API routes.
 *
 * Both sides import these constants so renaming an error string is caught at
 * compile time rather than silently falling through to a 500 response at
 * runtime.
 *
 * Partial-match constants (ERR_NEVER_SAY_*) are designed to be embedded inside
 * a longer message so the throw site can append human-readable context (term
 * name, limit number) while the catch site still matches via .includes().
 */

export const ERR_UNAUTHENTICATED = "Unauthenticated";
export const ERR_UNAUTHORIZED = "Unauthorized";
export const ERR_BLOG_NOT_FOUND = "Blog not found";
export const ERR_ENTRY_NOT_FOUND = "Entry not found";
/** Partial token: embedded in the full never-say limit-reached message. */
export const ERR_NEVER_SAY_LIMIT = "NEVER_SAY_LIMIT:";
/** Partial token: embedded in the full never-say duplicate-term message. */
export const ERR_NEVER_SAY_DUPLICATE = "NEVER_SAY_DUPLICATE:";

export const ERR_CALENDAR_NOT_FOUND = "Calendar item not found";

// Phase 3: Strategy & Keyword Intelligence
export const ERR_STRATEGY_NOT_FOUND = "Strategy not found";
export const ERR_KEYWORD_NOT_FOUND = "Keyword not found";
export const ERR_BRIEF_NOT_FOUND = "Brief not found";
export const ERR_BRIEF_ALREADY_WRITTEN = "Cannot reject a brief that has already been written";
/** Partial token: embedded in the keyword-already-briefed message. */
export const ERR_KEYWORD_ALREADY_BRIEFED = "KEYWORD_ALREADY_BRIEFED:";
