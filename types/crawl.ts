export type PageType = "homepage" | "about" | "blog" | "product" | "other";

export interface CrawledPage {
  url: string;
  type: PageType;
  title: string;
  content: string;
  wordCount: number;
}

export interface CrawlResult {
  pages: CrawledPage[];
  companyName: string;
  sitemapFound: boolean;
  totalWordCount: number;
}

export interface CrawlError {
  code: "invalid_url" | "blocked" | "spa" | "timeout" | "unknown";
  message: string;
}
