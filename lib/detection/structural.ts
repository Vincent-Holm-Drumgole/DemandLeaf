import type { DetectionFlag } from "@/types";
import { stripMarkdown, splitSentences, countWords } from "@/lib/text-utils";
import {
  SEVERITY_STRUCTURAL_PATTERN,
  MAX_EM_DASHES_PER_1000_WORDS,
  MAX_SEMICOLONS_PER_800_WORDS,
} from "@/lib/constants/detection";

/**
 * Detect structural patterns common in AI-generated text.
 * Each detected pattern adds severity points to the risk score.
 */
export function checkStructuralPatterns(content: string): DetectionFlag[] {
  const plainText = stripMarkdown(content);
  const flags: DetectionFlag[] = [];
  const wordCount = countWords(plainText);

  // 1. Rule of three: lists with exactly 3 items
  checkRuleOfThree(content, flags);

  // 2. AI opening patterns
  checkAIOpenings(plainText, flags);

  // 3. AI closing patterns
  checkAIClosings(plainText, flags);

  // 4. Excessive parallelism (3+ consecutive sentences with same structure)
  checkParallelism(plainText, flags);

  // 5. Excessive em dashes
  const emDashCount = (plainText.match(/—/g) || []).length;
  const maxEmDashes = Math.ceil((wordCount / 1000) * MAX_EM_DASHES_PER_1000_WORDS);
  if (emDashCount > maxEmDashes && emDashCount > 2) {
    flags.push({
      algorithm: "structural",
      severity: SEVERITY_STRUCTURAL_PATTERN,
      detail: `${emDashCount} em dashes found (max recommended: ${maxEmDashes})`,
    });
  }

  // 6. Excessive semicolons
  const semicolonCount = (plainText.match(/;/g) || []).length;
  const maxSemicolons = Math.ceil((wordCount / 800) * MAX_SEMICOLONS_PER_800_WORDS);
  if (semicolonCount > maxSemicolons && semicolonCount > 1) {
    flags.push({
      algorithm: "structural",
      severity: SEVERITY_STRUCTURAL_PATTERN,
      detail: `${semicolonCount} semicolons found (max recommended: ${maxSemicolons})`,
    });
  }

  return flags;
}

function checkRuleOfThree(content: string, flags: DetectionFlag[]): void {
  // Check for markdown lists with exactly 3 items
  const listBlocks = content.split(/\n\n+/);
  for (const block of listBlocks) {
    const listItems = block
      .split("\n")
      .filter((l) => /^\s*[-*+]\s/.test(l) || /^\s*\d+\.\s/.test(l));
    if (listItems.length === 3) {
      flags.push({
        algorithm: "structural",
        severity: SEVERITY_STRUCTURAL_PATTERN,
        detail: 'List with exactly 3 items detected (AI tell: "rule of three")',
      });
      break; // Only flag once
    }
  }

  // Check for "X, Y, and Z" comma patterns (exactly 3 items)
  const commaTriple = /\b(\w+(?:\s\w+)?),\s+(\w+(?:\s\w+)?),\s+and\s+(\w+(?:\s\w+)?)\b/g;
  const tripleMatches = [...content.matchAll(commaTriple)];
  if (tripleMatches.length >= 3) {
    flags.push({
      algorithm: "structural",
      severity: SEVERITY_STRUCTURAL_PATTERN,
      detail: `${tripleMatches.length} instances of "X, Y, and Z" pattern (rule of three)`,
    });
  }
}

function checkAIOpenings(text: string, flags: DetectionFlag[]): void {
  const firstParagraph = text.split(/\n\n/)[0] || "";
  const lowerFirst = firstParagraph.toLowerCase();

  const aiOpenings = [
    "in today's",
    "in the world of",
    "when it comes to",
    "have you ever wondered",
    "in an era",
    "in this article",
    "in this guide",
    "in this post",
  ];

  for (const opening of aiOpenings) {
    if (lowerFirst.startsWith(opening) || lowerFirst.includes(opening)) {
      flags.push({
        algorithm: "structural",
        severity: SEVERITY_STRUCTURAL_PATTERN,
        detail: `AI-typical opening detected: "${opening}"`,
      });
      break; // Only flag once for openings
    }
  }
}

function checkAIClosings(text: string, flags: DetectionFlag[]): void {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const lastParagraph = paragraphs[paragraphs.length - 1] || "";
  const lowerLast = lastParagraph.toLowerCase();

  const aiClosings = [
    "in summary",
    "in conclusion",
    "to sum up",
    "to summarize",
    "in closing",
    "as we've seen",
    "as we have seen",
  ];

  for (const closing of aiClosings) {
    if (lowerLast.includes(closing)) {
      flags.push({
        algorithm: "structural",
        severity: SEVERITY_STRUCTURAL_PATTERN,
        detail: `AI-typical closing detected: "${closing}"`,
      });
      break;
    }
  }
}

function checkParallelism(text: string, flags: DetectionFlag[]): void {
  const sentences = splitSentences(text);
  if (sentences.length < 4) return;

  let parallelCount = 0;

  for (let i = 1; i < sentences.length; i++) {
    const prevStart = getFirstWords(sentences[i - 1], 2);
    const currStart = getFirstWords(sentences[i], 2);

    if (prevStart && currStart && prevStart === currStart) {
      parallelCount++;
      if (parallelCount >= 2) {
        flags.push({
          algorithm: "structural",
          severity: SEVERITY_STRUCTURAL_PATTERN,
          detail: `3+ consecutive sentences starting with "${prevStart}..."`,
        });
        break;
      }
    } else {
      parallelCount = 0;
    }
  }
}

function getFirstWords(sentence: string, n: number): string {
  return sentence.trim().split(/\s+/).slice(0, n).join(" ").toLowerCase();
}
