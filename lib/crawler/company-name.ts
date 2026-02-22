import { extractOgSiteName, extractPageTitle } from "./parser";
import * as cheerio from "cheerio";

/**
 * Extract company name from HTML using multiple heuristics.
 * Priority: og:site_name > title (before separator) > application-name > h1 > domain
 */
export function extractCompanyName(html: string, url: string): string {
  // 1. og:site_name
  const ogSiteName = extractOgSiteName(html);
  if (ogSiteName && ogSiteName.length < 50) {
    return ogSiteName;
  }

  // 2. Title tag - take text before common separators
  const title = extractPageTitle(html);
  if (title) {
    const separators = [" | ", " - ", " :: ", " — ", " – "];
    for (const sep of separators) {
      const idx = title.indexOf(sep);
      if (idx > 0) {
        const name = title.substring(0, idx).trim();
        if (name.length > 1 && name.length < 40) {
          return name;
        }
      }
    }
    // If title is short enough, use it directly
    if (title.length < 30) {
      return title;
    }
  }

  // 3. application-name meta tag
  const $ = cheerio.load(html);
  const appName = $('meta[name="application-name"]').attr("content")?.trim();
  if (appName && appName.length < 50) {
    return appName;
  }

  // 4. First h1 if short
  const h1 = $("h1").first().text().trim();
  if (h1 && h1.split(/\s+/).length <= 5) {
    return h1;
  }

  // 5. Fallback: domain name
  try {
    const hostname = new URL(url).hostname;
    const name = hostname
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/-/g, " ");
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Unknown Company";
  }
}
