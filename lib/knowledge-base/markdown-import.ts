import type { KBEntryType } from "@/types";
import {
  MAX_KB_TAGS,
} from "./constants";
import { splitKnowledgeBaseEntryContent } from "./chunking";

export interface KnowledgeBaseImportDraft {
  id: string;
  title: string;
  content: string;
  entryType: KBEntryType;
  tags: string[];
  include: boolean;
  sourceHeading: string;
}

const TYPE_KEYWORDS: Array<{ entryType: KBEntryType; keywords: string[] }> = [
  { entryType: "company_info", keywords: ["company", "founder", "brand", "pricing"] },
  { entryType: "product", keywords: ["product", "capability", "feature", "connector", "engine"] },
  { entryType: "audience", keywords: ["audience", "buyer", "persona", "icp", "customer"] },
  { entryType: "competitor", keywords: ["competitor", "competitive", "vs."] },
  { entryType: "industry", keywords: ["industry", "market", "statistics"] },
  { entryType: "customer_story", keywords: ["scenario", "pain", "problem", "story"] },
  { entryType: "expert_insight", keywords: ["objection", "faq", "question"] },
  { entryType: "proprietary_data", keywords: ["data", "metric", "benchmark"] },
  { entryType: "methodology", keywords: ["glossary", "term", "definition"] },
  { entryType: "thought_leadership_position", keywords: ["seo", "content", "topic"] },
];

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "aldwin",
  "also",
  "because",
  "been",
  "before",
  "being",
  "between",
  "does",
  "each",
  "from",
  "have",
  "into",
  "just",
  "more",
  "most",
  "much",
  "only",
  "other",
  "over",
  "same",
  "some",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

function slugifyHeading(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "entry"}-${index}`;
}

export function detectKnowledgeBaseEntryType(heading: string): KBEntryType {
  const normalized = heading.toLowerCase();
  const match = TYPE_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );
  return match?.entryType ?? "company_info";
}

export function generateKnowledgeBaseTags(title: string, content: string): string[] {
  const frequency = new Map<string, number>();
  const source = `${title} ${content}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");

  for (const word of source.split(/\s+/)) {
    const normalized = word.trim();
    if (normalized.length < 4 || STOP_WORDS.has(normalized)) {
      continue;
    }
    frequency.set(normalized, (frequency.get(normalized) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_KB_TAGS)
    .map(([word]) => word);
}

export function parseKnowledgeBaseMarkdown(markdown: string): KnowledgeBaseImportDraft[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const matches = [...normalized.matchAll(/^##\s+(.+)$/gm)];

  if (matches.length === 0) {
    throw new Error("No H2 headings found. Use ## headings to split the document into entries.");
  }

  const drafts: KnowledgeBaseImportDraft[] = [];

  matches.forEach((match, index) => {
    const heading = match[1].trim();
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? normalized.length;
    const body = normalized.slice(bodyStart, bodyEnd).trim();

    if (!body) {
      return;
    }

    const entryType = detectKnowledgeBaseEntryType(heading);
    const sections = splitKnowledgeBaseEntryContent(body);

    sections.forEach((section, partIndex) => {
      const title = sections.length > 1 ? `${heading} (Part ${partIndex + 1})` : heading;
      drafts.push({
        id: slugifyHeading(title, drafts.length + 1),
        title,
        content: section,
        entryType,
        tags: generateKnowledgeBaseTags(title, section),
        include: true,
        sourceHeading: heading,
      });
    });
  });

  return drafts;
}
