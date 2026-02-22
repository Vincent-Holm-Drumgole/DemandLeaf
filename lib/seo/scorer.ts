import type { SEOScore, SEOCheckResult } from "@/types";
import { countWords, extractHeadings, extractParagraphs, stripMarkdown, splitSentences } from "@/lib/text-utils";
import { calculateFleschReadingEase } from "./readability";
import {
  KEYWORD_DENSITY_MIN, KEYWORD_DENSITY_MAX,
  TITLE_LENGTH_MIN, TITLE_LENGTH_MAX,
  META_DESC_LENGTH_MIN, META_DESC_LENGTH_MAX,
  MIN_H2_COUNT, MIN_CONTENT_WORDS,
  MAX_AVG_PARAGRAPH_SENTENCES, FLESCH_MIN, FLESCH_MAX,
  SUBHEADING_INTERVAL_WORDS, SLUG_MIN_WORDS, SLUG_MAX_WORDS,
  SEO_MAX_POINTS,
} from "@/lib/constants/seo";

export interface SEOScorerInput {
  content: string;      // markdown
  focusKeyword: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  title: string;
}

/**
 * Score blog content against 18 SEO checks. Pure code, no AI calls.
 * Returns a score 0-100 and individual check results.
 */
export function scoreSEO(input: SEOScorerInput): SEOScore {
  const { content, focusKeyword, metaTitle, metaDescription, slug, title } = input;
  const plainText = stripMarkdown(content);
  const lowerContent = plainText.toLowerCase();
  const lowerKeyword = focusKeyword.toLowerCase();
  const wordCount = countWords(plainText);
  const headings = extractHeadings(content);
  const paragraphs = extractParagraphs(content);

  const checks: SEOCheckResult[] = [
    checkKeywordInTitle(title, lowerKeyword, 10),
    checkKeywordInFirstTenPercent(lowerContent, lowerKeyword, 8),
    checkKeywordInMetaDescription(metaDescription, lowerKeyword, 8),
    checkKeywordInSlug(slug, lowerKeyword, 7),
    checkKeywordInH2(headings, lowerKeyword, 7),
    checkKeywordDensity(lowerContent, lowerKeyword, wordCount, 8),
    checkTitleLength(metaTitle, 5),
    checkMetaDescriptionLength(metaDescription, 5),
    checkH2Count(headings, 5),
    checkContentLength(wordCount, 5),
    checkExternalLink(content, 4),
    checkImageAlt(content, 4),
    checkParagraphLength(paragraphs, 4),
    checkFleschReadability(plainText, 4),
    checkHeadingHierarchy(headings, 4),
    checkCleanSlug(slug, 4),
    checkSubheadingFrequency(content, wordCount, 4),
    checkMetaTitleUnique(metaTitle, focusKeyword, 4),
  ];

  const totalPoints = checks.reduce((s, c) => s + c.points, 0);
  const score = Math.round((totalPoints / SEO_MAX_POINTS) * 100);

  return {
    score,
    checks,
    passedChecks: checks.filter((c) => c.passed).length,
    totalChecks: checks.length,
  };
}

// ─── Individual Check Functions ──────────────────────────────────────

function checkKeywordInTitle(title: string, keyword: string, maxPoints: number): SEOCheckResult {
  const passed = title.toLowerCase().includes(keyword);
  return {
    name: "Keyword in title",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : `Add "${keyword}" to your blog title`,
  };
}

function checkKeywordInFirstTenPercent(content: string, keyword: string, maxPoints: number): SEOCheckResult {
  const tenPercent = content.slice(0, Math.ceil(content.length * 0.1));
  const passed = tenPercent.includes(keyword);
  return {
    name: "Keyword in first 10%",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : `Mention "${keyword}" in the opening paragraph`,
  };
}

function checkKeywordInMetaDescription(metaDesc: string, keyword: string, maxPoints: number): SEOCheckResult {
  const passed = metaDesc.toLowerCase().includes(keyword);
  return {
    name: "Keyword in meta description",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : `Include "${keyword}" in the meta description`,
  };
}

function checkKeywordInSlug(slug: string, keyword: string, maxPoints: number): SEOCheckResult {
  const keywordSlug = keyword.replace(/\s+/g, "-").toLowerCase();
  const passed = slug.toLowerCase().includes(keywordSlug) ||
    keyword.split(/\s+/).every((w) => slug.toLowerCase().includes(w));
  return {
    name: "Keyword in URL/slug",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : `Include "${keyword}" in the URL slug`,
  };
}

function checkKeywordInH2(headings: { level: number; text: string }[], keyword: string, maxPoints: number): SEOCheckResult {
  const h2s = headings.filter((h) => h.level === 2);
  const passed = h2s.some((h) => h.text.toLowerCase().includes(keyword));
  return {
    name: "Keyword in H2",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : `Include "${keyword}" in at least one H2 heading`,
  };
}

function checkKeywordDensity(content: string, keyword: string, wordCount: number, maxPoints: number): SEOCheckResult {
  if (wordCount === 0) return { name: "Keyword density", passed: false, points: 0, maxPoints, suggestion: "Add content" };

  const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const matches = content.match(regex);
  const keywordCount = matches ? matches.length : 0;
  const keywordWordCount = keyword.split(/\s+/).length;
  const density = (keywordCount * keywordWordCount) / wordCount;
  const passed = density >= KEYWORD_DENSITY_MIN && density <= KEYWORD_DENSITY_MAX;

  return {
    name: "Keyword density",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : density < KEYWORD_DENSITY_MIN
        ? `Keyword density is ${(density * 100).toFixed(1)}%. Aim for 0.5-1.5%.`
        : `Keyword density is ${(density * 100).toFixed(1)}%. Reduce to 0.5-1.5%.`,
  };
}

function checkTitleLength(metaTitle: string, maxPoints: number): SEOCheckResult {
  const len = metaTitle.length;
  const passed = len >= TITLE_LENGTH_MIN && len <= TITLE_LENGTH_MAX;
  return {
    name: "Title length",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : `Meta title is ${len} chars. Aim for ${TITLE_LENGTH_MIN}-${TITLE_LENGTH_MAX}.`,
  };
}

function checkMetaDescriptionLength(metaDesc: string, maxPoints: number): SEOCheckResult {
  const len = metaDesc.length;
  const passed = len >= META_DESC_LENGTH_MIN && len <= META_DESC_LENGTH_MAX;
  return {
    name: "Meta description length",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : `Meta description is ${len} chars. Aim for ${META_DESC_LENGTH_MIN}-${META_DESC_LENGTH_MAX}.`,
  };
}

function checkH2Count(headings: { level: number; text: string }[], maxPoints: number): SEOCheckResult {
  const h2Count = headings.filter((h) => h.level === 2).length;
  const passed = h2Count >= MIN_H2_COUNT;
  return {
    name: "H2 count",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : `Add at least ${MIN_H2_COUNT} H2 headings`,
  };
}

function checkContentLength(wordCount: number, maxPoints: number): SEOCheckResult {
  const passed = wordCount >= MIN_CONTENT_WORDS;
  return {
    name: "Content length",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : `Content is ${wordCount} words. Aim for at least ${MIN_CONTENT_WORDS}.`,
  };
}

function checkExternalLink(content: string, maxPoints: number): SEOCheckResult {
  // Check for markdown links to external URLs
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const matches = [...content.matchAll(linkRegex)];
  const passed = matches.length >= 1;
  return {
    name: "External link",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : "Add at least 1 external link to a relevant resource",
  };
}

function checkImageAlt(content: string, maxPoints: number): SEOCheckResult {
  // Check for markdown images with alt text
  const imageRegex = /!\[([^\]]+)\]\(/g;
  const matches = [...content.matchAll(imageRegex)];
  const passed = matches.length >= 1;
  return {
    name: "Image alt text",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : "Add at least 1 image with descriptive alt text",
  };
}

function checkParagraphLength(paragraphs: string[], maxPoints: number): SEOCheckResult {
  if (paragraphs.length === 0) return { name: "Short paragraphs", passed: false, points: 0, maxPoints };

  const sentenceCounts = paragraphs.map((p) => splitSentences(p).length);
  const avgSentences = sentenceCounts.reduce((a, b) => a + b, 0) / sentenceCounts.length;
  const passed = avgSentences <= MAX_AVG_PARAGRAPH_SENTENCES;
  return {
    name: "Short paragraphs",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : `Average paragraph has ${avgSentences.toFixed(1)} sentences. Keep under ${MAX_AVG_PARAGRAPH_SENTENCES}.`,
  };
}

function checkFleschReadability(plainText: string, maxPoints: number): SEOCheckResult {
  const score = calculateFleschReadingEase(plainText);
  const passed = score >= FLESCH_MIN && score <= FLESCH_MAX;
  return {
    name: "Flesch readability",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : `Flesch score is ${score.toFixed(0)}. Aim for ${FLESCH_MIN}-${FLESCH_MAX}.`,
  };
}

function checkHeadingHierarchy(headings: { level: number; text: string }[], maxPoints: number): SEOCheckResult {
  if (headings.length === 0) return { name: "Heading hierarchy", passed: true, points: maxPoints, maxPoints };

  let passed = true;
  let prevLevel = 0;
  let seenH2 = false;

  for (const h of headings) {
    if (h.level >= 2 && prevLevel > 0 && h.level > prevLevel + 1) {
      passed = false;
      break;
    }

    if (h.level === 2) {
      seenH2 = true;
    }
    if (h.level === 3 && !seenH2) {
      passed = false;
      break;
    }

    prevLevel = h.level;
  }

  // Check H1 count (should be 0 or 1 in body — title is the H1)
  const h1Count = headings.filter((h) => h.level === 1).length;
  if (h1Count > 1) passed = false;

  return {
    name: "Heading hierarchy",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed ? undefined : "Use only one H1 and follow H1 > H2 > H3 hierarchy",
  };
}

function checkCleanSlug(slug: string, maxPoints: number): SEOCheckResult {
  if (!slug) return { name: "Clean slug", passed: false, points: 0, maxPoints, suggestion: "Generate a URL slug" };

  const words = slug.split("-").filter((w) => w.length > 0);
  const isLowercase = slug === slug.toLowerCase();
  const isHyphenated = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const wordCountOk = words.length >= SLUG_MIN_WORDS && words.length <= SLUG_MAX_WORDS;
  const passed = isLowercase && isHyphenated && wordCountOk;

  return {
    name: "Clean slug",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : `Slug should be ${SLUG_MIN_WORDS}-${SLUG_MAX_WORDS} lowercase words separated by hyphens`,
  };
}

function checkSubheadingFrequency(content: string, wordCount: number, maxPoints: number): SEOCheckResult {
  const headings = extractHeadings(content);
  const subheadings = headings.filter((h) => h.level >= 2);
  const expectedSubheadings = Math.floor(wordCount / SUBHEADING_INTERVAL_WORDS);
  const passed = subheadings.length >= expectedSubheadings || subheadings.length >= 2;

  return {
    name: "Subheading frequency",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : `Add a subheading at least every ${SUBHEADING_INTERVAL_WORDS} words`,
  };
}

function checkMetaTitleUnique(metaTitle: string, keyword: string, maxPoints: number): SEOCheckResult {
  // Meta title shouldn't just be the keyword alone
  const titleWords = metaTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const keywordWords = keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const nonKeywordWords = titleWords.filter((w) => !keywordWords.includes(w));
  const passed = nonKeywordWords.length >= 2;

  return {
    name: "Meta title unique",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : "Meta title should contain more than just the keyword",
  };
}
