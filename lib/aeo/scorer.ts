import type { AeoScore, AeoCheckResult } from "@/types";
import { extractHeadings, stripMarkdown } from "@/lib/text-utils";

export const AEO_MAX_POINTS = 100;
export const AEO_PASS_THRESHOLD = 60;

export interface AeoScorerInput {
  content: string; // markdown
}

export function scoreAEO(input: AeoScorerInput): AeoScore {
  const { content } = input;
  const plain = stripMarkdown(content);
  const headings = extractHeadings(content);

  const checks: AeoCheckResult[] = [
    checkFaqSection(content, 20),
    checkQuestionHeadings(headings, 20),
    checkStatisticsCount(plain, 20),
    checkExtractablePassages(content, 20),
    checkListsOrTables(content, 10),
    checkSourceCitations(content, 10),
  ];

  const totalPoints = checks.reduce((s, c) => s + c.points, 0);
  const score = Math.round((totalPoints / AEO_MAX_POINTS) * 100);

  return {
    score,
    checks,
    passedChecks: checks.filter((c) => c.passed).length,
    totalChecks: checks.length,
  };
}

// ── Individual Check Functions ──────────────────────────────────────

function checkFaqSection(content: string, maxPoints: number): AeoCheckResult {
  const hasFaq =
    /^#{1,3}\s+(faq|frequently asked questions)/im.test(content) ||
    /\*\*Q:/m.test(content);
  return {
    name: "FAQ section present",
    passed: hasFaq,
    points: hasFaq ? maxPoints : 0,
    maxPoints,
    suggestion: hasFaq ? undefined : "Add a FAQ section with an H2 heading",
  };
}

function checkQuestionHeadings(
  headings: { level: number; text: string }[],
  maxPoints: number
): AeoCheckResult {
  const questionCount = headings.filter((h) =>
    h.text.trim().endsWith("?")
  ).length;
  const passed = questionCount >= 2;
  return {
    name: "Question-format headings (≥2)",
    passed,
    points: passed ? maxPoints : questionCount > 0 ? Math.round(maxPoints * 0.5) : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : "Rephrase at least 2 headings as direct questions",
  };
}

function checkStatisticsCount(plain: string, maxPoints: number): AeoCheckResult {
  const statsRegex =
    /\b\d+(?:\.\d+)?%|\b\d+\s*(?:percent|in\s+\d+|million|billion|thousand)\b/gi;
  const matches = plain.match(statsRegex) ?? [];
  const passed = matches.length >= 2;
  return {
    name: "Statistics / data points (≥2)",
    passed,
    points: passed ? maxPoints : matches.length === 1 ? Math.round(maxPoints * 0.5) : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : "Include at least 2 statistics or data points",
  };
}

function checkExtractablePassages(
  content: string,
  maxPoints: number
): AeoCheckResult {
  const paragraphs = content
    .split(/\n\n+/)
    .filter(
      (p) =>
        !p.startsWith("#") && !p.startsWith("-") && !p.startsWith("*") && p.trim().length > 0
    );
  const concise = paragraphs.filter((p) => {
    const wc = (p.match(/\S+/g) ?? []).length;
    return wc >= 40 && wc <= 80;
  });
  const passed = concise.length >= 1;
  return {
    name: "Extractable answer passage (40-80 words)",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : "Add a concise 40-80 word answer paragraph near the top of a section",
  };
}

function checkListsOrTables(content: string, maxPoints: number): AeoCheckResult {
  const hasList = /^[-*]\s/m.test(content) || /^\d+\.\s/m.test(content);
  const hasTable = /\|.+\|.+\|/m.test(content);
  const passed = hasList || hasTable;
  return {
    name: "Lists or tables present",
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
    suggestion: passed
      ? undefined
      : "Add a bulleted list or comparison table",
  };
}

function checkSourceCitations(
  content: string,
  maxPoints: number
): AeoCheckResult {
  const hasCitation =
    /\[.+?\]\(https?:\/\/.+?\)/m.test(content) ||
    /\(source:/i.test(content) ||
    /according to\s+[A-Z]/m.test(content);
  return {
    name: "Source citations present",
    passed: hasCitation,
    points: hasCitation ? maxPoints : 0,
    maxPoints,
    suggestion: hasCitation
      ? undefined
      : "Add at least one source citation or external link",
  };
}
