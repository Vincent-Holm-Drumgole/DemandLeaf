import type { PageType } from "@/types";

/**
 * Classify a page type based on URL patterns and content heuristics.
 */
export function classifyPage(url: string, content: string): PageType {
  const pathname = new URL(url).pathname.toLowerCase();

  // Homepage
  if (pathname === "/" || pathname === "/home" || pathname === "/index.html") {
    return "homepage";
  }

  // About page
  if (
    /\/(about|about-us|company|team|our-story|who-we-are)(\/?|\.html?)$/i.test(
      pathname
    )
  ) {
    return "about";
  }

  // Blog post (URL contains blog/post/article path segments and is not the index)
  if (
    /\/(blog|posts?|articles?|news|insights|resources)\/[^/]+/i.test(
      pathname
    ) ||
    /\/\d{4}\/\d{2}\//.test(pathname) // Date-based blog URLs
  ) {
    return "blog";
  }

  // Blog index page
  if (/^\/(blog|posts?|articles?|news|insights|resources)\/?$/i.test(pathname)) {
    return "other";
  }

  // Product/service pages
  if (
    /\/(products?|services?|pricing|features?|solutions?|plans?)(\/?|\/[^/]+\/?)?$/i.test(
      pathname
    )
  ) {
    return "product";
  }

  // Fallback: check content length as a heuristic for blog posts
  // Blog posts tend to be longer-form content
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 500 && /\/(blog|posts?|articles?)\//.test(url)) {
    return "blog";
  }

  return "other";
}

/**
 * Identify likely blog/about/content links from homepage.
 */
export function findContentLinks(
  links: string[],
  expectedHostname: string
): { blogLinks: string[]; aboutLink: string | null } {
  const normalize = (value: string) => value.toLowerCase().replace(/^www\./, "");
  const expected = normalize(expectedHostname);

  const sameSite = links.filter((l) => {
    try {
      const host = normalize(new URL(l).hostname);
      return host === expected || host.endsWith(`.${expected}`) || expected.endsWith(`.${host}`);
    } catch {
      return false;
    }
  });

  const aboutLink =
    sameSite.find((l) =>
      /\/(about|about-us|company|team|our-story)(\/?|\.html?)$/i.test(l)
    ) || null;

  // Find blog index or individual blog posts
  const blogLinks = sameSite.filter((l) =>
    /\/(blog|posts?|articles?|news|insights|resources)(\/|$)/i.test(l)
  );

  return { blogLinks, aboutLink };
}
