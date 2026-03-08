import type { DetectionFlag } from "@/types";

const MAX_CONSECUTIVE_REPEATED_OPENERS = 3;
const SEVERITY_REPEATED_OPENER = 6;

function getSentenceOpener(sentence: string): string {
  return sentence
    .trim()
    .replace(/^[^A-Za-z0-9]+/, "")
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .toLowerCase();
}

export function checkSentenceOpenerRepetition(content: string): DetectionFlag[] {
  const paragraphs = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  const flags: DetectionFlag[] = [];
  let lastOpener = "";
  let streak = 0;

  paragraphs.forEach((paragraph, index) => {
    const opener = getSentenceOpener(paragraph);
    if (!opener) return;

    if (opener === lastOpener) {
      streak += 1;
    } else {
      lastOpener = opener;
      streak = 1;
    }

    if (streak >= MAX_CONSECUTIVE_REPEATED_OPENERS) {
      flags.push({
        algorithm: "sentence_opener_repetition",
        severity: SEVERITY_REPEATED_OPENER,
        location: `paragraph ${index}`,
        detail: `Repeated opener pattern detected: "${opener}" appears in ${streak} consecutive paragraphs`,
      });
    }
  });

  return flags;
}
