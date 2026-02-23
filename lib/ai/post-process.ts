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

function replaceBannedWords(content: string): string {
  let result = content;

  for (const [banned, synonym] of Object.entries(SYNONYM_MAP)) {
    const escaped = banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");

    result = result.replace(regex, (match) => {
      const firstChar = match[0];
      if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
        return synonym.charAt(0).toUpperCase() + synonym.slice(1);
      }
      return synonym;
    });
  }

  return result;
}
