import { fetchPage, isFetchResult } from "./fetcher";

interface SitemapOptions {
  fetcher?: typeof fetchPage;
  allowUrl?: (url: string) => boolean;
  isTimedOut?: () => boolean;
}

/**
 * Try to find and parse a sitemap for the given domain.
 * Checks /sitemap.xml, /sitemap_index.xml, and robots.txt for sitemap reference.
 */
export async function findSitemapUrls(
  baseUrl: string,
  options: SitemapOptions = {}
): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const fetcher = options.fetcher ?? fetchPage;
  const allowUrl =
    options.allowUrl ??
    ((candidateUrl: string) => {
      try {
        return new URL(candidateUrl).origin === origin;
      } catch {
        return false;
      }
    });
  const isTimedOut = options.isTimedOut ?? (() => false);
  const urls: string[] = [];

  // Try standard sitemap locations
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    if (isTimedOut()) return urls;

    const result = await fetcher(sitemapUrl);
    if (isFetchResult(result)) {
      const parsed = parseSitemapXml(result.html).filter((u) => allowUrl(u));
      if (parsed.length > 0) {
        urls.push(...parsed);
        break;
      }
    }
  }

  // If no sitemap found, try robots.txt for sitemap reference
  if (urls.length === 0) {
    if (isTimedOut()) return urls;

    const robotsResult = await fetcher(`${origin}/robots.txt`);
    if (isFetchResult(robotsResult)) {
      const sitemapFromRobots = extractSitemapFromRobots(robotsResult.html);
      if (sitemapFromRobots && allowUrl(sitemapFromRobots)) {
        if (isTimedOut()) return urls;

        const result = await fetcher(sitemapFromRobots);
        if (isFetchResult(result)) {
          urls.push(...parseSitemapXml(result.html).filter((u) => allowUrl(u)));
        }
      }
    }
  }

  return urls;
}

/**
 * Parse sitemap XML and extract URLs.
 * Handles both regular sitemaps and sitemap indexes.
 */
function parseSitemapXml(xml: string): string[] {
  const urls: string[] = [];

  // Extract <loc> tags (works for both sitemaps and sitemap indexes)
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * Extract sitemap URL from robots.txt content.
 */
function extractSitemapFromRobots(robotsTxt: string): string | null {
  const lines = robotsTxt.split("\n");
  for (const line of lines) {
    const match = line.match(/^Sitemap:\s*(.+)/i);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}
