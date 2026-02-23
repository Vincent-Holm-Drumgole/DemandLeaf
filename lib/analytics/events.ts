/**
 * Analytics event name constants.
 * Used by PostHog tracking and the analytics_events DB table.
 */
export const ANALYTICS_EVENTS = {
  // Onboarding funnel
  URL_SUBMITTED: "url_submitted",
  CRAWL_COMPLETED: "crawl_completed",
  CRAWL_FAILED: "crawl_failed",
  KEYWORD_ENTERED: "keyword_entered",
  GENERATION_STARTED: "generation_started",
  GENERATION_COMPLETED: "generation_completed",
  GENERATION_FAILED: "generation_failed",

  // Blog interaction
  BLOG_EXPORTED: "blog_exported",
  BLOG_FEEDBACK_GIVEN: "blog_feedback_given",

  // Auth
  SIGNUP_COMPLETED: "signup_completed",
  LOGIN_COMPLETED: "login_completed",

  // Activation metrics
  FIRST_BLOG_GENERATED: "first_blog_generated",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
