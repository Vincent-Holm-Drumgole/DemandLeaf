import "server-only";
import type { GoogleTokens, GSCPostMetrics } from "@/types";
import { refreshAccessToken } from "./oauth";

const GSC_BASE = "https://searchconsole.googleapis.com/webmasters/v3";

async function gscFetch(
  tokens: GoogleTokens,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${GSC_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`GSC API ${method} ${path} → ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch clicks, impressions, CTR, avg position from GSC for a specific page.
 * FM-5: returns null on API failure.
 */
export async function getPostSearchMetrics(
  tokens: GoogleTokens,
  siteUrl: string,
  pageUrl: string,
  startDate: string,
  endDate: string
): Promise<GSCPostMetrics | null> {
  try {
    let activeTokens = tokens;
    if (Date.now() >= tokens.expiresAt - 60_000) {
      activeTokens = await refreshAccessToken(tokens);
    }

    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const data = (await gscFetch(
      activeTokens,
      "POST",
      `/sites/${encodedSiteUrl}/searchAnalytics/query`,
      {
        startDate,
        endDate,
        dimensions: ["page"],
        dimensionFilterGroups: [
          {
            filters: [
              { dimension: "page", operator: "equals", expression: pageUrl },
            ],
          },
        ],
      }
    )) as {
      rows?: {
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }[];
    };

    const row = data.rows?.[0];
    if (!row) {
      return {
        blogUrl: pageUrl,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        avgPosition: 0,
        periodStart: new Date(startDate).getTime(),
        periodEnd: new Date(endDate).getTime(),
      };
    }

    return {
      blogUrl: pageUrl,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      avgPosition: row.position,
      periodStart: new Date(startDate).getTime(),
      periodEnd: new Date(endDate).getTime(),
    };
  } catch (err) {
    console.error("[gsc-client] getPostSearchMetrics failed:", err);
    return null;
  }
}

/**
 * List all verified sites/properties for the authenticated user.
 * Used during setup to populate property picker.
 */
export async function listVerifiedSites(
  tokens: GoogleTokens
): Promise<string[]> {
  try {
    let activeTokens = tokens;
    if (Date.now() >= tokens.expiresAt - 60_000) {
      activeTokens = await refreshAccessToken(tokens);
    }

    const data = (await gscFetch(activeTokens, "GET", "/sites")) as {
      siteEntry?: { siteUrl: string; permissionLevel: string }[];
    };

    return (data.siteEntry ?? []).map((s) => s.siteUrl);
  } catch (err) {
    console.error("[gsc-client] listVerifiedSites failed:", err);
    return [];
  }
}
