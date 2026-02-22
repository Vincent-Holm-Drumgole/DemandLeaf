import type { DetectionFlag } from "@/types";
import { ALL_BANNED_WORDS, BANNED_PHRASES } from "@/lib/constants/banned-words";
import { SEVERITY_BANNED_WORD } from "@/lib/constants/detection";
import { stripMarkdown } from "@/lib/text-utils";

interface BannedWordMatch {
  word: string;
  location: string;
}

/**
 * Scan content for banned words and phrases from Appendix A.
 * Case-insensitive matching. Returns each occurrence with location.
 */
export function scanBannedWords(content: string): {
  matches: BannedWordMatch[];
  flags: DetectionFlag[];
} {
  const plainText = stripMarkdown(content);
  const lowerText = plainText.toLowerCase();
  const matches: BannedWordMatch[] = [];

  // Check individual banned words
  for (const word of ALL_BANNED_WORDS) {
    const lowerWord = word.toLowerCase();
    // Word boundary matching to avoid partial matches (e.g., "navigate" in "navigation")
    const regex = new RegExp(`\\b${escapeRegex(lowerWord)}\\b`, "gi");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lowerText)) !== null) {
      // Find approximate paragraph location
      const textBefore = plainText.slice(0, match.index);
      const paragraphIndex = textBefore.split(/\n\n+/).length - 1;
      matches.push({
        word,
        location: `paragraph ${paragraphIndex}`,
      });
    }
  }

  // Check banned phrases
  for (const phrase of BANNED_PHRASES) {
    const lowerPhrase = phrase.toLowerCase();
    // Handle "Not only...but also" pattern specially
    if (lowerPhrase.includes("...")) {
      const parts = lowerPhrase.split("...");
      if (parts.length === 2) {
        const regex = new RegExp(
          `${escapeRegex(parts[0].trim())}[\\s\\S]{0,120}?${escapeRegex(parts[1].trim())}`,
          "gi"
        );
        let match: RegExpExecArray | null;
        while ((match = regex.exec(lowerText)) !== null) {
          const textBefore = plainText.slice(0, match.index);
          const paragraphIndex = textBefore.split(/\n\n+/).length - 1;
          matches.push({
            word: phrase,
            location: `paragraph ${paragraphIndex}`,
          });
        }
      }
      continue;
    }

    const regex = new RegExp(escapeRegex(lowerPhrase), "gi");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lowerText)) !== null) {
      const textBefore = plainText.slice(0, match.index);
      const paragraphIndex = textBefore.split(/\n\n+/).length - 1;
      matches.push({
        word: phrase,
        location: `paragraph ${paragraphIndex}`,
      });
    }
  }

  const flags: DetectionFlag[] = matches.map((m) => ({
    algorithm: "banned_words",
    severity: SEVERITY_BANNED_WORD,
    location: m.location,
    detail: `Found banned word/phrase: "${m.word}"`,
  }));

  return { matches, flags };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
