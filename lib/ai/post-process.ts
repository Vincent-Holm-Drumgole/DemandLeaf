import { countWords, stripMarkdown } from "@/lib/text-utils";
import { MAX_EM_DASHES_PER_1000_WORDS } from "@/lib/constants/detection";

/**
 * Reliable code-based post-processing applied after all AI generation steps.
 * Fixes patterns the model introduces despite prompt instructions.
 */
export function postProcessContent(content: string): string {
  const wordCount = countWords(stripMarkdown(content));
  let result = content;
  result = normalizeEmDashes(result, wordCount);
  result = replaceBannedWords(result);
  return result;
}

/**
 * Replace excess em dashes with commas.
 * Claude Sonnet consistently overuses em dashes even when instructed not to.
 * This keeps the first `maxAllowed` em dashes and replaces the rest.
 */
function normalizeEmDashes(content: string, wordCount: number): string {
  const emDashCount = (content.match(/—/g) || []).length;
  const maxAllowed = Math.ceil((wordCount / 1000) * MAX_EM_DASHES_PER_1000_WORDS);

  if (emDashCount <= maxAllowed) return content;

  let seen = 0;
  return content.replace(/(\s*)—(\s*)/g, (match) => {
    seen++;
    if (seen <= maxAllowed) return match;
    // " — " → ", " | "word—word" → "word, word"
    return ", ";
  });
}

/**
 * Replace banned AI-tell words with neutral synonyms.
 * Capitalisation of the replacement matches the original.
 */
const SYNONYM_MAP: Record<string, string> = {
  // Verbs
  delve: "explore",
  leverage: "use",
  navigate: "handle",
  harness: "use",
  illuminate: "explain",
  underscore: "highlight",
  spearhead: "lead",
  streamline: "simplify",
  revolutionize: "transform",
  catalyze: "drive",
  embark: "start",
  foster: "build",
  cultivate: "develop",
  bolster: "strengthen",
  amplify: "increase",
  // Adjectives
  robust: "strong",
  comprehensive: "complete",
  seamless: "smooth",
  pivotal: "key",
  transformative: "significant",
  groundbreaking: "new",
  "cutting-edge": "advanced",
  holistic: "broad",
  nuanced: "detailed",
  multifaceted: "complex",
  "game-changing": "major",
  unparalleled: "exceptional",
  bespoke: "custom",
  meticulous: "careful",
  paramount: "essential",
  // Nouns
  landscape: "space",
  realm: "area",
  paradigm: "approach",
  synergy: "collaboration",
  ecosystem: "environment",
  tapestry: "mix",
  nexus: "center",
  interplay: "relationship",
};

/**
 * Build a regex that matches the banned word and common inflected forms.
 * Words ending in 'e' (e.g. "delve"): matches delve, delves, delved, delving.
 * Other words (e.g. "foster"): matches foster, fosters, fostered, fostering.
 * Hyphenated compounds (e.g. "cutting-edge") match the exact form only.
 */
function buildWordRegex(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (word.includes("-")) {
    return new RegExp(`\\b${escaped}\\b`, "gi");
  }
  if (word.endsWith("e")) {
    const stem = escaped.slice(0, -1);
    return new RegExp(`\\b${stem}(?:e(?:s|d)?|ing)\\b`, "gi");
  }
  return new RegExp(`\\b${escaped}(?:s|ed|ing)?\\b`, "gi");
}

function replaceBannedWords(content: string): string {
  let result = content;

  for (const [banned, synonym] of Object.entries(SYNONYM_MAP)) {
    const regex = buildWordRegex(banned);

    result = result.replace(regex, (match) => {
      // Preserve ALL-CAPS emphasis (e.g. "DELVE" → "EXPLORE")
      if (match === match.toUpperCase() && match !== match.toLowerCase()) {
        return synonym.toUpperCase();
      }
      const firstChar = match[0];
      if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
        return synonym.charAt(0).toUpperCase() + synonym.slice(1);
      }
      return synonym;
    });
  }

  return result;
}
