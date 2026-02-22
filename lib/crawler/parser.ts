import * as cheerio from "cheerio";

/**
 * Parse HTML and extract clean text content.
 * Strips scripts, styles, nav, footer, aside, header elements.
 * Preserves heading hierarchy as markdown-style markers.
 */
export function parseHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove elements that don't contain content
  $(
    "script, style, nav, footer, header, aside, iframe, noscript, svg, form"
  ).remove();

  // Remove common non-content elements by class/id
  $(
    '[class*="nav"], [class*="menu"], [class*="sidebar"], [class*="footer"], [class*="cookie"], [class*="popup"], [class*="modal"], [id*="nav"], [id*="menu"], [id*="sidebar"], [id*="footer"]'
  ).remove();

  const parts: string[] = [];

  // Process headings and paragraphs in order
  $("h1, h2, h3, h4, h5, h6, p, li").each((_i, el) => {
    const tagName = $(el).prop("tagName")?.toLowerCase() || "";
    const text = $(el).text().trim();

    if (!text) return;

    if (tagName.startsWith("h")) {
      const level = parseInt(tagName[1]);
      const prefix = "#".repeat(level);
      parts.push(`${prefix} ${text}`);
    } else {
      parts.push(text);
    }
  });

  // Collapse whitespace and join
  return parts
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
}

/**
 * Extract the page title from HTML.
 */
export function extractPageTitle(html: string): string {
  const $ = cheerio.load(html);
  return $("title").first().text().trim();
}

/**
 * Extract meta description from HTML.
 */
export function extractMetaDescription(html: string): string {
  const $ = cheerio.load(html);
  return (
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    ""
  );
}

/**
 * Extract all links from the page.
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const absolute = new URL(href, baseUrl).href;
      links.push(absolute);
    } catch {
      // Skip invalid URLs
    }
  });

  return [...new Set(links)];
}

/**
 * Extract og:site_name meta tag.
 */
export function extractOgSiteName(html: string): string | null {
  const $ = cheerio.load(html);
  return $('meta[property="og:site_name"]').attr("content")?.trim() || null;
}
