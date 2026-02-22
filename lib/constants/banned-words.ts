// Complete Appendix A from Product Bible v4
// This is the single source of truth for banned words/phrases.
// Used by: detection module, prompt templates, quality gates.

export const BANNED_VERBS = [
  "delve",
  "leverage",
  "navigate",
  "harness",
  "illuminate",
  "underscore",
  "spearhead",
  "streamline",
  "revolutionize",
  "catalyze",
  "embark",
  "foster",
  "cultivate",
  "bolster",
  "amplify",
] as const;

export const BANNED_ADJECTIVES = [
  "robust",
  "comprehensive",
  "seamless",
  "pivotal",
  "transformative",
  "groundbreaking",
  "cutting-edge",
  "holistic",
  "nuanced",
  "multifaceted",
  "game-changing",
  "unparalleled",
  "bespoke",
  "meticulous",
  "paramount",
] as const;

export const BANNED_NOUNS = [
  "landscape",
  "realm",
  "paradigm",
  "synergy",
  "ecosystem",
  "tapestry",
  "nexus",
  "interplay",
] as const;

export const BANNED_PHRASES = [
  "In today's",
  "Whether you're a",
  "At its core",
  "It's worth noting",
  "It is important to note",
  "At the end of the day",
  "In summary",
  "In conclusion",
  "Let's dive in",
  "Let's delve into",
  "Not only...but also",
  "In the realm of",
  "When it comes to",
  "The ever-evolving",
  "Moving forward",
  "That said",
  "It goes without saying",
  "Needless to say",
  "As we all know",
  "Have you ever wondered",
] as const;

export const ALL_BANNED_WORDS = [
  ...BANNED_VERBS,
  ...BANNED_ADJECTIVES,
  ...BANNED_NOUNS,
] as const;

export const BANNED_META_OPENERS = [
  "Discover",
  "Unlock",
  "Master",
  "Explore",
] as const;

export type BannedWord = (typeof ALL_BANNED_WORDS)[number];
export type BannedPhrase = (typeof BANNED_PHRASES)[number];
