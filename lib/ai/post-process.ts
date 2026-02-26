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
 * Words ending in consonant+'y' (e.g. "synergy", "amplify"): matches synergy,
 *   synergies, amplify, amplifies, amplified, amplifying.
 * Words ending in vowel+'y' (e.g. "interplay") and all other words: adds
 *   optional s/ed/ing suffix.
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
  // Consonant + 'y': y → ies (plural/3rd-person), ied (past), ying (participle)
  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) {
    const stem = escaped.slice(0, -1);
    return new RegExp(`\\b${stem}(?:y|ies|ied|ying)\\b`, "gi");
  }
  return new RegExp(`\\b${escaped}(?:s|ed|ing)?\\b`, "gi");
}

type InflectionType = "base" | "plural" | "past" | "participle";

/**
 * Detect what inflected form the regex matched.
 * Check for exact base-word match first so adjectives ending in "ed"
 * (e.g. "nuanced") are correctly classified as "base", not "past".
 */
function getInflectionType(match: string, banned: string): InflectionType {
  if (match.toLowerCase() === banned.toLowerCase()) return "base";
  const m = match.toLowerCase();
  if (m.endsWith("ing")) return "participle";
  if (m.endsWith("ied") || m.endsWith("ed")) return "past";
  if (m.endsWith("ies") || m.endsWith("es") || m.endsWith("s")) return "plural";
  return "base";
}

/**
 * Apply the same inflection to the synonym so the replacement is grammatically
 * correct (e.g. "delving" → "exploring", "fosters" → "builds").
 * Note: irregular verbs (build/lead/handle) are a known limitation — they will
 * produce regular forms ("builded", "leaded") which is still better than always
 * returning the bare infinitive.
 */
function applyInflection(synonym: string, inflection: InflectionType): string {
  if (inflection === "base") return synonym;
  if (inflection === "participle") {
    return synonym.endsWith("e") ? synonym.slice(0, -1) + "ing" : synonym + "ing";
  }
  if (inflection === "past") {
    if (synonym.endsWith("e")) return synonym + "d";
    if (/[^aeiou]y$/i.test(synonym)) return synonym.slice(0, -1) + "ied";
    return synonym + "ed";
  }
  // plural / 3rd-person singular present
  if (/[^aeiou]y$/i.test(synonym)) return synonym.slice(0, -1) + "ies";
  if (/(?:s|sh|ch|x|z)$/i.test(synonym)) return synonym + "es";
  return synonym + "s";
}

function replaceBannedWords(content: string): string {
  let result = content;

  for (const [banned, synonym] of Object.entries(SYNONYM_MAP)) {
    const regex = buildWordRegex(banned);

    result = result.replace(regex, (match) => {
      const inflection = getInflectionType(match, banned);
      const inflected = applyInflection(synonym, inflection);

      // Preserve ALL-CAPS emphasis (e.g. "DELVING" → "EXPLORING")
      if (match === match.toUpperCase() && match !== match.toLowerCase()) {
        return inflected.toUpperCase();
      }
      // Preserve Title Case (e.g. "Delving" → "Exploring")
      const firstChar = match[0];
      if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
        return inflected.charAt(0).toUpperCase() + inflected.slice(1);
      }
      return inflected;
    });
  }

  return result;
}
