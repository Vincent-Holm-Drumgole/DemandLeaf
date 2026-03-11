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
export const ERR_WORKSPACE_MISMATCH = "Workspace mismatch";
export const ERR_BLOG_NOT_FOUND = "Blog not found";
export const ERR_ENTRY_NOT_FOUND = "Entry not found";
export const ERR_BLOG_ALREADY_SCORED = "Blog already scored";
/** Partial token: embedded in the full never-say limit-reached message. */
export const ERR_NEVER_SAY_LIMIT = "NEVER_SAY_LIMIT:";
/** Partial token: embedded in the full never-say duplicate-term message. */
export const ERR_NEVER_SAY_DUPLICATE = "NEVER_SAY_DUPLICATE:";

export const ERR_INVALID_PARAGRAPH_INDEX = "Invalid paragraph index";
export const ERR_INVALID_VOICE_MATCH_SCORE = "voiceMatchScore must be between 0 and 100";
export const ERR_INVALID_DIMENSION_SCORE = "Dimension scores must be integers between 1 and 5";
export const ERR_COACHING_NOTE_TOO_LONG = "Coaching note is too long";
export const ERR_BATCH_TOO_LARGE = "Batch too large";
export const ERR_CALENDAR_NOT_FOUND = "Calendar item not found";

export const ERR_CLUSTER_NOT_FOUND = "Cluster not found";

// Phase 3: Strategy & Keyword Intelligence
export const ERR_STRATEGY_NOT_FOUND = "Strategy not found";
export const ERR_KEYWORD_NOT_FOUND = "Keyword not found";
export const ERR_BRIEF_NOT_FOUND = "Brief not found";
export const ERR_BRIEF_ALREADY_WRITTEN = "Cannot reject a brief that has already been written";
/** Partial token: embedded in the keyword-already-briefed message. */
export const ERR_KEYWORD_ALREADY_BRIEFED = "KEYWORD_ALREADY_BRIEFED:";

// Phase 5: AEO/GEO & Publishing
export const ERR_WP_CONNECTION_NOT_FOUND = "WordPress connection not found";
export const ERR_WP_CONNECTION_FAILED = "WordPress connection test failed";
export const ERR_AUTHOR_PERSONA_NOT_FOUND = "Author persona not found";
export const ERR_BLOG_ALREADY_PUBLISHED = "Blog is already published to WordPress";
export const ERR_INTERNAL_LINK_NOT_FOUND = "Internal link not found";

// Phase 6: Post-Publish Intelligence
export const ERR_GOOGLE_CONNECTION_NOT_FOUND = "Google connection not found";
export const ERR_DECAY_ALERT_NOT_FOUND = "Decay alert not found";
export const ERR_REFRESH_NOT_FOUND = "Refresh history record not found";
export const ERR_BLOG_NOT_PUBLISHED = "Blog must be published before tracking";
export const ERR_NO_FOCUS_KEYWORD = "Blog has no focusKeyword set";

// Phase 7: Agentic Operations
export const ERR_AGENT_ACTION_NOT_FOUND = "Agent action not found";
export const ERR_AGENT_ACTION_NOT_PENDING = "Agent action is not in pending state";
export const ERR_AGENT_ACTION_NOT_APPROVED = "Agent action is not in approved state";
export const ERR_INVALID_AGENT_PAYLOAD = "Invalid agent payload";
export const ERR_NOTIFICATION_NOT_FOUND = "Notification not found";

// Phase 8: Agentic Operations v2
export const ERR_COMPETITOR_TRACKING_NOT_FOUND = "Competitor tracking not found";
export const ERR_PUBLISHING_AGENT_NOT_ACTIVE = "Publishing agent is paused or not activated";
export const ERR_TRUST_GATE_NOT_MET = "Trust gate requirements not met";
export const ERR_PUBLISHING_CONFIG_NOT_FOUND = "Publishing agent config not found";

// Content Review
export const ERR_REVIEW_REQUEST_NOT_FOUND = "Review request not found";
export const ERR_REVIEW_COMMENT_NOT_FOUND = "Review comment not found";

// Billing
export const ERR_SUBSCRIPTION_REQUIRED = "Subscription required";
export const ERR_WORKSPACE_NOT_FOUND = "Workspace not found";
