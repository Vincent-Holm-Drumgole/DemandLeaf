// Detection risk thresholds
export const DETECTION_LOW_MAX = 20;
export const DETECTION_MEDIUM_MAX = 50;
// Above 50 = high

// Burstiness thresholds
export const BURSTINESS_SD_MIN = 8;
export const BURSTINESS_SHORT_SENTENCE_MIN_PERCENT = 0.15; // 15% under 8 words
export const BURSTINESS_LONG_SENTENCE_MIN_PERCENT = 0.10; // 10% over 25 words
export const SHORT_SENTENCE_MAX_WORDS = 8; // under this value
export const LONG_SENTENCE_MIN_WORDS = 25; // over this value
export const MAX_CONSECUTIVE_SIMILAR_LENGTH = 3; // max sentences within 5 words of each other
export const SENTENCE_SIMILARITY_DELTA = 5;

// Severity points
export const SEVERITY_LOW_BURSTINESS = 15;
export const SEVERITY_LOW_SHORT_SENTENCES = 5;
export const SEVERITY_LOW_LONG_SENTENCES = 5;
export const SEVERITY_BANNED_WORD = 5;
export const SEVERITY_STRUCTURAL_PATTERN = 8;
export const SEVERITY_LOW_PARAGRAPH_VARIATION = 10;
export const SEVERITY_LOW_HEADING_VARIATION = 5;

// Paragraph variation thresholds
export const PARAGRAPH_SIMILARITY_THRESHOLD = 10; // words
export const MIN_DISTINCT_PARAGRAPH_LENGTHS_PER_500 = 3;

// Structural pattern thresholds
export const MAX_EM_DASHES_PER_1000_WORDS = 3;
export const MAX_SEMICOLONS_PER_800_WORDS = 1;
