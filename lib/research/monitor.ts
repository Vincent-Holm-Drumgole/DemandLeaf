import * as cheerio from "cheerio";

export interface ResearchItem {
  title: string;
  url: string;
  summary: string;
  publishedAt?: number;
  sourceName: string;
}

export interface ResearchSignals {
  keywords: string[];
  clusterTerms: string[];
  kbTags: string[];
}

export async function fetchResearchSourceItems(source: {
  type: "rss" | "url";
  url: string;
  label: string;
}): Promise<ResearchItem[]> {
  const response = await fetch(source.url, {
    headers: {
      "user-agent": "DemandLeaf Research Monitor/1.0",
      accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9",
    },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status}`);
  }

  if (source.type === "rss" || body.includes("<rss") || body.includes("<feed")) {
    return parseRssItems(body, source.label);
  }

  return parseHtmlItems(body, source.url, source.label);
}

export function scoreResearchItem(item: ResearchItem, signals: ResearchSignals): number {
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  const keywordScore = scoreTokenMatches(haystack, signals.keywords) * 4;
  const clusterScore = scoreTokenMatches(haystack, signals.clusterTerms) * 3;
  const kbScore = scoreTokenMatches(haystack, signals.kbTags) * 2;
  return Math.min(100, keywordScore + clusterScore + kbScore + 15);
}

export function buildResearchBrief(item: ResearchItem, relevanceScore: number) {
  return {
    title: item.title,
    summary: item.summary,
    whyItMatters: `${item.title} matters because it affects operating assumptions, platform decisions, or execution patterns that Aldwin content speaks to.`,
    suggestedAngle: `Explain what changed, who it affects, and where conventional commentary on "${item.title}" is missing operational nuance.`,
    sourceUrls: [item.url],
    sourceNames: [item.sourceName],
    keywords: extractResearchKeywords(`${item.title} ${item.summary}`),
    relevanceScore,
  };
}

export function buildTrendReportBrief(items: ResearchItem[]) {
  const titles = items.slice(0, 5).map((item) => item.title);
  const combined = items.map((item) => `${item.title}. ${item.summary}`).join(" ");
  return {
    title: `Monthly trend report: ${titles[0] ?? "Research roundup"}`,
    summary: `Recurring themes this month: ${titles.join("; ")}`,
    whyItMatters: "This trend report aggregates multiple monitored changes into a single view of what operators should pay attention to next.",
    suggestedAngle: "Synthesize the common pattern across the monitored updates and translate it into concrete execution advice.",
    sourceUrls: items.map((item) => item.url),
    sourceNames: items.map((item) => item.sourceName),
    keywords: extractResearchKeywords(combined),
    relevanceScore: 90,
  };
}

function parseRssItems(xml: string, sourceName: string): ResearchItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => match[1])
    .slice(0, 10);
  if (items.length === 0) {
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]
      .map((match) => match[1])
      .slice(0, 10)
      .map((entry) => rssNodeToItem(entry, sourceName))
      .filter((item): item is ResearchItem => item !== null);
  }

  return items
    .map((item) => rssNodeToItem(item, sourceName))
    .filter((item): item is ResearchItem => item !== null);
}

function rssNodeToItem(node: string, sourceName: string): ResearchItem | null {
  const title = decodeHtml(getNodeValue(node, "title"));
  const url =
    decodeHtml(getNodeValue(node, "link")) ||
    decodeHtml(node.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "");
  const summary = decodeHtml(getNodeValue(node, "description") || getNodeValue(node, "summary"));
  const publishedRaw = getNodeValue(node, "pubDate") || getNodeValue(node, "updated");

  if (!title || !url) return null;
  return {
    title,
    url,
    summary: summary || title,
    publishedAt: publishedRaw ? Date.parse(publishedRaw) : undefined,
    sourceName,
  };
}

function parseHtmlItems(html: string, baseUrl: string, sourceName: string): ResearchItem[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const items: ResearchItem[] = [];

  $("article a, main a, .post a, .entry a, h2 a, h3 a").each((_, element) => {
    if (items.length >= 8) return false;
    const title = $(element).text().trim().replace(/\s+/g, " ");
    const href = $(element).attr("href");
    if (!title || !href || title.length < 20) return;
    const url = new URL(href, baseUrl).toString();
    if (seen.has(url)) return;
    seen.add(url);
    const summary =
      $(element).closest("article").find("p").first().text().trim()
      || $(element).parent().next("p").text().trim()
      || title;
    items.push({
      title,
      url,
      summary,
      sourceName,
    });
  });

  return items;
}

function getNodeValue(node: string, tag: string): string {
  return node.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim() ?? "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function extractResearchKeywords(value: string): string[] {
  const stopWords = new Set(["the", "and", "with", "from", "that", "this", "into", "your", "what"]);
  const frequency = new Map<string, number>();
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopWords.has(token))
    .forEach((token) => {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    });

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token]) => token);
}

function scoreTokenMatches(text: string, tokens: string[]): number {
  return [...new Set(tokens.map((token) => token.toLowerCase().trim()).filter(Boolean))]
    .reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
}
