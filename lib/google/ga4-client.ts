import "server-only";
import type { GoogleTokens, GA4PostMetrics } from "@/types";
import { refreshAccessToken } from "./oauth";

const GA4_BASE = "https://analyticsdata.googleapis.com/v1beta";

async function ga4Fetch(
  tokens: GoogleTokens,
  path: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(`${GA4_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`GA4 API ${path} → ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch sessions, pageviews, engagement time, and bounce rate for a specific
 * page path from GA4.
 *
 * FM-5: returns null on any API failure — callers must treat null as
 * "GA4 unavailable" and surface a UI warning.
 */
export async function getPostMetrics(
  tokens: GoogleTokens,
  propertyId: string,
  pageUrl: string,
  startDate: string,
  endDate: string
): Promise<GA4PostMetrics | null> {
  try {
    let activeTokens = tokens;
    if (Date.now() >= tokens.expiresAt - 60_000) {
      activeTokens = await refreshAccessToken(tokens);
    }

    const pagePath = new URL(pageUrl).pathname;

    const data = (await ga4Fetch(
      activeTokens,
      `/${propertyId}:runReport`,
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "EXACT", value: pagePath },
          },
        },
      }
    )) as {
      rows?: {
        metricValues: { value: string }[];
      }[];
    };

    const row = data.rows?.[0];
    if (!row) {
      return {
        blogUrl: pageUrl,
        sessions: 0,
        pageviews: 0,
        avgEngagementTimeSec: 0,
        bounceRate: 0,
        periodStart: new Date(startDate).getTime(),
        periodEnd: new Date(endDate).getTime(),
      };
    }

    const vals = row.metricValues;
    return {
      blogUrl: pageUrl,
      sessions: parseFloat(vals[0]?.value ?? "0"),
      pageviews: parseFloat(vals[1]?.value ?? "0"),
      avgEngagementTimeSec: parseFloat(vals[2]?.value ?? "0"),
      bounceRate: parseFloat(vals[3]?.value ?? "0"),
      periodStart: new Date(startDate).getTime(),
      periodEnd: new Date(endDate).getTime(),
    };
  } catch (err) {
    console.error("[ga4-client] getPostMetrics failed:", err);
    return null;
  }
}
