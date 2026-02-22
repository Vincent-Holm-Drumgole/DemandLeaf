import type { CrawlResult, CrawlError, CrawledPage } from "@/types";
import { fetchPage, isFetchResult, type FetchError, type FetchResult } from "./fetcher";
import { parseHtml, extractPageTitle, extractLinks } from "./parser";
import { findSitemapUrls } from "./sitemap";
import { classifyPage, findContentLinks } from "./classifier";
import { extractCompanyName } from "./company-name";
import { countWords } from "@/lib/text-utils";
import {
  normalizeAndValidateCrawlUrl,
  isAllowedSameSiteUrl,
  isSafePublicHttpUrl,
} from "./url-safety";

const CRAWL_TIMEOUT_MS = 15000;
const PAGE_TIMEOUT_MS = 5000;
const MAX_PAGES = 10;
const MAX_BLOG_POSTS = 8;
const MIN_CONTENT_WORDS = 50;

/**
 * Crawl a website starting from the given URL.
 * Fetches homepage, finds sitemap/blog/about links, crawls up to 10 pages.
 * Returns clean text content with page classifications.
 *
 * Total crawl time capped at 15 seconds.
 */
export async function crawlWebsite(
  inputUrl: string
): Promise<CrawlResult | CrawlError> {
  // 1. Normalize URL
  let url: string;
  try {
    url = normalizeAndValidateCrawlUrl(inputUrl);
  } catch {
    return {
      code: "invalid_url",
      message:
        "That doesn't look like a valid URL. Check for typos and try again.",
    };
  }

  const requestedHostname = new URL(url).hostname;
  const startTime = Date.now();
  const pages: CrawledPage[] = [];
  const visitedUrls = new Set<string>();

  const remainingMs = () => CRAWL_TIMEOUT_MS - (Date.now() - startTime);
  const isTimedOut = () => remainingMs() <= 0;
  const isAllowedUrl = (candidateUrl: string) =>
    isAllowedSameSiteUrl(candidateUrl, requestedHostname);

  const fetchWithDeadline = async (targetUrl: string): Promise<FetchResult | FetchError> => {
    if (isTimedOut()) {
      return {
        url: targetUrl,
        code: "timeout",
        message: "Crawl timed out",
      };
    }

    return fetchPage(targetUrl, {
      timeoutMs: Math.max(1, Math.min(PAGE_TIMEOUT_MS, remainingMs())),
      validateUrl: isAllowedUrl,
    });
  };

  // 2. Fetch homepage
  const homepageResult = await fetchWithDeadline(url);
  if (!isFetchResult(homepageResult)) {
    if (homepageResult.code === "timeout") {
      return {
        code: "timeout",
        message: "Your site took too long to respond. Try again in a moment.",
      };
    }
    if (
      homepageResult.code === "http_403" ||
      homepageResult.code === "http_401"
    ) {
      return {
        code: "blocked",
        message:
          "Your site blocks our crawler. You can skip the crawl and tell us about your company instead.",
      };
    }
    return {
      code: "unknown",
      message: `We couldn't reach ${url}. Check the URL and try again.`,
    };
  }

  if (!isSafePublicHttpUrl(homepageResult.url)) {
    return {
      code: "invalid_url",
      message: "The final crawl destination is not a publicly routable URL.",
    };
  }

  const origin = new URL(homepageResult.url).origin;

  // 3. Parse homepage
  const homepageContent = parseHtml(homepageResult.html);
  const homepageWordCount = countWords(homepageContent);

  if (homepageWordCount < MIN_CONTENT_WORDS) {
    // Could be an SPA or very minimal site
    // Still try to extract what we can
  }

  visitedUrls.add(homepageResult.url);
  pages.push({
    url: homepageResult.url,
    type: "homepage",
    title: extractPageTitle(homepageResult.html),
    content: homepageContent,
    wordCount: homepageWordCount,
  });

  const companyName = extractCompanyName(homepageResult.html, url);

  // 4. Find links from homepage
  const allLinks = extractLinks(homepageResult.html, homepageResult.url);
  const { blogLinks, aboutLink } = findContentLinks(allLinks, requestedHostname);

  // 5. Try to find sitemap for blog URLs
  let sitemapFound = false;
  let blogPostUrls: string[] = [];

  if (!isTimedOut()) {
    const sitemapUrls = await findSitemapUrls(homepageResult.url, {
      fetcher: fetchWithDeadline,
      isTimedOut,
      allowUrl: (candidateUrl) => {
        if (!isAllowedUrl(candidateUrl)) return false;
        try {
          return new URL(candidateUrl).origin === origin;
        } catch {
          return false;
        }
      },
    });
    if (sitemapUrls.length > 0) {
      sitemapFound = true;
      // Filter to blog-like URLs from sitemap
      blogPostUrls = sitemapUrls.filter(
        (u) =>
          /\/(blog|posts?|articles?|news|insights)\/[^/]+/i.test(u) &&
          !visitedUrls.has(u)
      );
    }
  }

  // If no blog URLs from sitemap, use links found on homepage
  if (blogPostUrls.length === 0) {
    blogPostUrls = blogLinks.filter(
      (l) =>
        !visitedUrls.has(l) &&
        isAllowedUrl(l) &&
        // Filter out blog index pages, keep individual posts
        !/\/(blog|posts?|articles?)\/?$/i.test(new URL(l).pathname)
    );
  }

  // 6. Crawl about page
  if (aboutLink && !visitedUrls.has(aboutLink) && !isTimedOut()) {
    const aboutResult = await fetchWithDeadline(aboutLink);
    if (isFetchResult(aboutResult)) {
      visitedUrls.add(aboutResult.url);
      const content = parseHtml(aboutResult.html);
      pages.push({
        url: aboutResult.url,
        type: "about",
        title: extractPageTitle(aboutResult.html),
        content,
        wordCount: countWords(content),
      });
    }
  }

  // 7. Crawl blog posts (up to MAX_BLOG_POSTS)
  const blogUrlsToCrawl = blogPostUrls.slice(0, MAX_BLOG_POSTS);

  for (const blogUrl of blogUrlsToCrawl) {
    if (isTimedOut() || pages.length >= MAX_PAGES) break;
    if (visitedUrls.has(blogUrl)) continue;

    const result = await fetchWithDeadline(blogUrl);
    if (!isFetchResult(result)) continue;

    visitedUrls.add(result.url);
    const content = parseHtml(result.html);
    const wordCount = countWords(content);

    // Skip very short pages (likely not real content)
    if (wordCount < MIN_CONTENT_WORDS) continue;

    pages.push({
      url: result.url,
      type: classifyPage(result.url, content),
      title: extractPageTitle(result.html),
      content,
      wordCount,
    });
  }

  // 8. Check if we got enough content
  const totalWordCount = pages.reduce((sum, p) => sum + p.wordCount, 0);

  if (totalWordCount < MIN_CONTENT_WORDS) {
    return {
      code: "spa",
      message:
        "Your site has very little text content for us to analyze. You can tell us about your company instead.",
    };
  }

  return {
    pages,
    companyName,
    sitemapFound,
    totalWordCount,
  };
}

/**
 * Type guard to check if result is a successful crawl.
 */
export function isCrawlResult(
  result: CrawlResult | CrawlError
): result is CrawlResult {
  return "pages" in result;
}
