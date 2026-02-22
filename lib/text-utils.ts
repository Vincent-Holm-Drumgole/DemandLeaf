// Abbreviations that contain periods but don't end sentences
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "ave", "blvd",
  "dept", "est", "fig", "inc", "ltd", "corp", "vs", "etc", "approx",
  "govt", "i.e", "e.g", "vol", "no", "gen", "sen", "rep",
  "u.s", "u.k",
]);

const DOT_PLACEHOLDER = "__DOT__";
const ELLIPSIS_PLACEHOLDER = "__ELLIPSIS__";
const ABBREVIATION_REGEX = new RegExp(
  `\\b(?:${Array.from(ABBREVIATIONS)
    .map((abbr) => abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\.`,
  "gi"
);

const SYLLABLE_EXCEPTIONS: Record<string, number> = {
  extraordinary: 6,
  business: 2,
  every: 2,
  beautiful: 3,
};

/**
 * Split text into sentences. Handles abbreviations, URLs, and decimals.
 */
export function splitSentences(text: string): string[] {
  const cleaned = stripMarkdown(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const protectedText = cleaned
    // Protect URLs.
    .replace(
      /\b(?:https?:\/\/|www\.)[^\s)]+/gi,
      (url) => {
        const coreUrl = url.replace(/[.!?,;:]+$/g, "");
        const trailing = url.slice(coreUrl.length);
        return coreUrl.replace(/\./g, DOT_PLACEHOLDER) + trailing;
      }
    )
    // Protect ellipsis.
    .replace(/\.\.\./g, ELLIPSIS_PLACEHOLDER)
    // Protect decimal numbers.
    .replace(/(\d)\.(\d)/g, `$1${DOT_PLACEHOLDER}$2`)
    // Protect common abbreviations.
    .replace(ABBREVIATION_REGEX, (match) =>
      match.replace(/\./g, DOT_PLACEHOLDER)
    );

  const raw = protectedText.split(
    /(?<=[.!?])\s+(?=(?:["'([{]*[A-Z0-9]))|(?<=[.!?])\s*$/
  );

  return raw
    .map((s) =>
      s
        .replace(new RegExp(DOT_PLACEHOLDER, "g"), ".")
        .replace(new RegExp(ELLIPSIS_PLACEHOLDER, "g"), "...")
        .trim()
    )
    .filter((s) => s.length > 0 && countWords(s) > 0);
}

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
  return (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
}

/**
 * Extract markdown headings with their level and text.
 */
export function extractHeadings(
  markdown: string
): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }
  return headings;
}

/**
 * Extract paragraphs from markdown (split by double newlines).
 * Filters out headings and empty blocks.
 */
export function extractParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith("#"));
}

/**
 * Strip markdown formatting to get plain text.
 * Removes headings markers, bold, italic, links, images, code blocks, etc.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      // Convert links to just text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove heading markers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, "")
      // Remove blockquotes
      .replace(/^>\s+/gm, "")
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Collapse whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Extract the title from markdown (first H1 heading).
 */
export function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

/**
 * Generate a URL slug from a title.
 */
export function generateSlug(title: string, keyword?: string): string {
  const STOP_WORDS = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "it", "this", "that", "are", "was", "be",
    "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "can", "from", "into", "your", "you", "how", "what",
  ]);

  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Keep keyword words even if they're stop words
  const keywordWords = keyword
    ? keyword.toLowerCase().split(/\s+/)
    : [];

  const filtered = words.filter(
    (w) => !STOP_WORDS.has(w) || keywordWords.includes(w)
  );

  const deduped: string[] = [];
  for (const word of filtered) {
    if (!deduped.includes(word)) deduped.push(word);
  }

  if (deduped.length < 3) {
    for (const keywordWord of keywordWords) {
      const normalized = keywordWord.replace(/[^a-z0-9]/g, "");
      if (normalized && !deduped.includes(normalized)) {
        deduped.push(normalized);
      }
      if (deduped.length >= 3) break;
    }
  }

  if (deduped.length < 3) {
    for (const word of words) {
      if (!deduped.includes(word)) deduped.push(word);
      if (deduped.length >= 3) break;
    }
  }

  if (deduped.length < 3) {
    deduped.push("guide", "tips", "strategy");
  }

  return deduped
    .slice(0, 5)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Count syllables in a word (heuristic).
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w in SYLLABLE_EXCEPTIONS) return SYLLABLE_EXCEPTIONS[w];
  if (w.length <= 2) return 1;

  let processed = w;

  // Remove common silent suffixes first.
  processed = processed.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  processed = processed.replace(/^y/, "");

  const groups = processed.match(/[aeiouy]{1,2}/g);
  let count = groups ? groups.length : 0;

  // Handle words where adjacent vowels are pronounced separately.
  if (/(ia|io|eo|ua|uo)/.test(processed)) {
    count += 1;
  }

  return Math.max(1, count);
}

/**
 * Count total syllables in a text.
 */
export function countTotalSyllables(text: string): number {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .reduce((sum, word) => sum + countSyllables(word), 0);
}
