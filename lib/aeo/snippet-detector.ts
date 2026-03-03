import { extractHeadings } from "@/lib/text-utils";
import type { SnippetOpportunity } from "@/types";

/**
 * Detect headings/sections that are strong featured-snippet candidates.
 * Pure code — no AI.
 */
export function detectSnippetOpportunities(
  content: string
): SnippetOpportunity[] {
  const headings = extractHeadings(content);
  const opportunities: SnippetOpportunity[] = [];

  headings.forEach((h, idx) => {
    const text = h.text.trim();
    const lower = text.toLowerCase();

    if (text.endsWith("?")) {
      opportunities.push({
        type: "faq",
        headingText: text,
        headingIndex: idx,
        snippetType: "Featured snippet (direct answer)",
      });
    } else if (/^(what is|what are|define|definition of)\b/i.test(lower)) {
      opportunities.push({
        type: "definition",
        headingText: text,
        headingIndex: idx,
        snippetType: "Definition snippet",
      });
    } else if (/^(how to|steps to|guide to|ways to)\b/i.test(lower)) {
      opportunities.push({
        type: "steps",
        headingText: text,
        headingIndex: idx,
        snippetType: "Steps/numbered-list snippet",
      });
    }
  });

  // Check for list/table snippet opportunities
  if (/^[-*]\s.+\n[-*]\s.+\n[-*]\s/m.test(content)) {
    opportunities.push({
      type: "list",
      headingText: "(bulleted list detected)",
      headingIndex: -1,
      snippetType: "List snippet",
    });
  }

  if (/\|.+\|.+\|\n\|[-:]+\|/m.test(content)) {
    opportunities.push({
      type: "table",
      headingText: "(markdown table detected)",
      headingIndex: -1,
      snippetType: "Table snippet",
    });
  }

  return opportunities;
}
