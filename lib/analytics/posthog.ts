import posthog from "posthog-js";
import type { AnalyticsEventName } from "./events";

let initialized = false;

/**
 * Initialize PostHog client-side tracking.
 * Call once in the PostHogProvider component.
 */
export function initPostHog() {
  if (initialized || typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
  });

  initialized = true;
}

/**
 * Track a custom event.
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  properties?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  posthog.capture(eventName, properties);
}

/**
 * Identify a user after signup/login.
 */
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  posthog.identify(userId, traits);
}

/**
 * Reset user identity on logout.
 */
export function resetUser() {
  if (typeof window === "undefined") return;
  posthog.reset();
}
