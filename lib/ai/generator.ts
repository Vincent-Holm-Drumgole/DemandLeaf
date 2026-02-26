import type { GenerationInput, GenerationResult, PipelineStep } from "@/types";
import { callSonnet, callHaiku, parseJsonResponse } from "./client";
import { TokenTracker } from "./token-tracker";
import { generateBrief } from "./brief";
import { postProcessContent } from "./post-process";
import {
  buildBlogDraftPrompt,
  buildSectionRevisionPrompt,
  buildMetaGenerationPrompt,
  type RevisionFlag,
  PROMPT_VERSION,
} from "./prompts";
import type { MetaGenerationResult } from "./prompts";
import { checkVoiceAdherence } from "@/lib/voice/match";
import { scoreSEO } from "@/lib/seo/scorer";
import { detectAIContent } from "@/lib/detection/detector";
import { evaluateQualityGates } from "@/lib/quality/gates";
import {
  extractTitle,
  generateSlug,
  countWords,
  stripMarkdown,
  extractParagraphs,
} from "@/lib/text-utils";
import { calculateFleschReadingEase } from "@/lib/seo/readability";
import { marked } from "marked";
import { sanitizeGeneratedHtml } from "@/lib/html-sanitize";
import { ARCHETYPES } from "@/lib/constants/archetypes";
import { BANNED_META_OPENERS } from "@/lib/constants/banned-words";

export type ProgressCallback = (step: PipelineStep) => void;

/**
 * The core blog generation pipeline.
 *
 * 1. Generate brief (Sonnet)
 * 2. Generate draft (Sonnet, 5-layer prompt)
 * 3. Voice check (Haiku)
 * 4. SEO check (code)
 * 5. Anti-detection check (code)
 * 6. Revision pass (Sonnet, only if flags)
 * 6b. Post-process content (code) — markdown → HTML, HTML sanitization
 * 7. Meta generation (Haiku)
 * 8. Final scoring (code)
 */
export async function generateBlog(
  input: GenerationInput,
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  if (!ARCHETYPES[input.archetype]) {
    throw new Error(`Unsupported archetype: ${String(input.archetype)}`);
  }

  const tracker = new TokenTracker();
  const startTime = Date.now();

  // ── Step 1: Generate brief (or use pre-approved hint) ──────────────
  onProgress?.({ name: "Researching your topic", status: "running" });
  let brief: Awaited<ReturnType<typeof generateBrief>>["brief"];
  if (input.briefHint) {
    // Use the pre-approved Phase 3 content brief — skip Claude call for Step 1
    const firstOutlineHeading = input.briefHint.outline
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("## "))
      ?.replace(/^##\s+/, "");
    brief = {
      title: firstOutlineHeading || input.keyword,
      outline: input.briefHint.outline,
      hookOptions: (() => {
        const provided = input.briefHint.hookOptions.filter((h) => h.trim().length > 0);
        const defaults = [
          `Most teams overlook the fundamentals of ${input.keyword}.`,
          `${input.keyword} gets easier once you stop following generic playbooks.`,
          `The biggest mistake with ${input.keyword} is skipping foundational setup.`,
        ];
        return [...provided, ...defaults].slice(0, 3);
      })(),
      uniqueAngle: "",
    };
    onProgress?.({ name: "Researching your topic", status: "complete", durationMs: 0 });
  } else {
    const { brief: generatedBrief, aiResult: briefResult } = await generateBrief({
      keyword: input.keyword,
      archetype: input.archetype,
      industry: input.industry,
      audience: input.audience,
      companyContext: input.companyContext,
    });
    brief = generatedBrief;
    tracker.record("brief", briefResult);
    onProgress?.({ name: "Researching your topic", status: "complete", durationMs: briefResult.durationMs });
  }

  // ── Step 2: Generate draft (5-layer prompt) ────────────────────────
  onProgress?.({ name: "Writing in your voice", status: "running" });

  // Format KB context if provided (Phase 2)
  let kbContextString: string | undefined;
  if (input.kbContext && input.kbContext.items.length > 0) {
    const { formatKBContextForPrompt } = await import("@/lib/knowledge-base/formatter");
    kbContextString = formatKBContextForPrompt(input.kbContext);
  }

  const { systemPrompt, userMessage } = buildBlogDraftPrompt({
    archetype: input.archetype,
    voiceProfile: input.voiceProfile,
    keyword: input.keyword,
    companyContext: input.companyContext,
    industry: input.industry,
    audience: input.audience,
    outline: brief.outline,
    kbContext: kbContextString,
    neverSayTerms: input.neverSayTerms,
    hookOptions: brief.hookOptions,
    uniqueAngle: brief.uniqueAngle || undefined,
  });

  const draftResult = await callSonnet(systemPrompt, userMessage, {
    maxTokens: 8192,
    temperature: 0.8,
  });
  tracker.record("draft_generation", draftResult);
  let blogContent = draftResult.content;
  onProgress?.({ name: "Writing in your voice", status: "complete", durationMs: draftResult.durationMs });

  // ── Step 3: Voice check (Haiku) ────────────────────────────────────
  onProgress?.({ name: "Checking voice consistency", status: "running" });
  let voiceFlags: Array<{ paragraphIndex: number; reason: string }> = [];
  // overallScore is 1-5 scale; normalize to 0-100 for voiceMatchScore
  let voiceMatchScore: number | undefined;
  try {
    const voiceCheck = await checkVoiceAdherence(blogContent, input.voiceProfile);
    tracker.record("voice_check", voiceCheck.aiResult);
    voiceFlags = voiceCheck.result.flags.map((flag) => ({
      paragraphIndex: flag.paragraphIndex,
      reason: flag.reason,
    }));
    voiceMatchScore = Math.round(((voiceCheck.result.overallScore - 1) / 4) * 100);
    onProgress?.({
      name: "Checking voice consistency",
      status: "complete",
      durationMs: voiceCheck.aiResult.durationMs,
    });
  } catch {
    // Non-critical check: continue if voice check fails.
    onProgress?.({ name: "Checking voice consistency", status: "error" });
  }

  // ── Step 4: SEO check (code) ───────────────────────────────────────
  onProgress?.({ name: "Optimizing for search", status: "running" });
  const title = extractTitle(blogContent) || brief.title;

  // ── Step 5: Anti-detection check (code) ────────────────────────────
  const initialDetection = detectAIContent(blogContent);
  onProgress?.({ name: "Optimizing for search", status: "complete" });

  // ── Step 6: Revision pass (Sonnet, only if needed) ─────────────────
  const detectionFlags = initialDetection.flags;
  const needsRevision = voiceFlags.length > 0 || detectionFlags.length > 0;

  if (needsRevision) {
    onProgress?.({ name: "Polishing content", status: "running" });

    const revisionFlags: RevisionFlag[] = [
      ...voiceFlags.map((f) => ({
        paragraphIndex: f.paragraphIndex,
        originalText: getParagraphText(blogContent, f.paragraphIndex),
        issue: f.reason,
        instruction: `Rewrite to match voice profile. ${f.reason}`,
      })),
      ...detectionFlags.map((f) => {
        const paragraphIndex = extractParagraphIndex(f.location);
        const originalText =
          paragraphIndex === null ? undefined : getParagraphText(blogContent, paragraphIndex);

        if (paragraphIndex === null || !originalText) {
          return {
            issue: f.detail,
            instruction: `Fix this pattern across the draft: ${f.detail}`,
          };
        }

        return {
          paragraphIndex,
          originalText,
          issue: f.detail,
          instruction: `Fix: ${f.detail}. Vary sentence lengths, use natural word choices.`,
        };
      }),
    ];

    if (revisionFlags.length > 0) {
      const { systemPrompt: revSys, userMessage: revUser } =
        buildSectionRevisionPrompt(blogContent, revisionFlags, input.voiceProfile);

      try {
        const revisionResult = await callSonnet(revSys, revUser, {
          maxTokens: 8192,
          temperature: 0.6,
        });
        tracker.record("revision_pass", revisionResult);
        blogContent = revisionResult.content;
      } catch {
        // Keep original draft when revision fails.
      }
    }

    onProgress?.({ name: "Polishing content", status: "complete" });
  }

  // ── Post-processing: fix em dashes and banned words in code ────────
  blogContent = postProcessContent(blogContent);

  // ── Step 7: Meta generation (Haiku) ────────────────────────────────
  onProgress?.({ name: "Generating metadata", status: "running" });
  const finalTitle = extractTitle(blogContent) || title;
  const firstParagraph = extractParagraphs(blogContent)[0] || "";

  const { systemPrompt: metaSys, userMessage: metaUser } =
    buildMetaGenerationPrompt(
      input.keyword,
      finalTitle,
      firstParagraph,
      input.archetype,
      input.voiceProfile.toneAttributes
    );

  let metaTitle = buildFallbackMetaTitle(finalTitle, input.keyword);
  let metaDescription = buildFallbackMetaDescription(input.keyword, finalTitle);

  try {
    const metaResult = await callHaiku(metaSys, metaUser, {
      temperature: 0.5,
      maxTokens: 1024,
    });
    tracker.record("meta_generation", metaResult);

    const metaParsed = parseJsonResponse<MetaGenerationResult>(metaResult.content);
    metaTitle = pickValidMetaTitle(
      metaParsed.titles,
      metaParsed.recommendedTitle,
      finalTitle,
      input.keyword
    );
    metaDescription = pickValidMetaDescription(
      metaParsed.descriptions,
      metaParsed.recommendedDescription,
      input.keyword,
      finalTitle
    );

    onProgress?.({
      name: "Generating metadata",
      status: "complete",
      durationMs: metaResult.durationMs,
    });
  } catch {
    onProgress?.({ name: "Generating metadata", status: "error" });
  }

  // ── Step 8: Final scoring (code) ───────────────────────────────────
  onProgress?.({ name: "Running quality checks", status: "running" });

  const finalSlug = generateSlug(finalTitle, input.keyword);
  const plainText = stripMarkdown(blogContent);
  const wordCount = countWords(plainText);
  const readabilityScore = calculateFleschReadingEase(plainText);
  const finalDetection = detectAIContent(blogContent);
  const finalSeoScore = scoreSEO({
    content: blogContent,
    focusKeyword: input.keyword,
    metaTitle,
    metaDescription,
    slug: finalSlug,
    title: finalTitle,
  });

  const headingHierarchyCheck = finalSeoScore.checks.find(
    (check) => check.name === "Heading hierarchy"
  );
  const headingStructureValid = headingHierarchyCheck?.passed ?? true;
  const bannedWordsFound = finalDetection.flags.filter(
    (f) => f.algorithm === "banned_words"
  ).length;

  const qualityGates = evaluateQualityGates({
    seoScore: finalSeoScore.score,
    detectionResult: finalDetection,
    readabilityScore,
    wordCount,
    archetype: input.archetype,
    headingStructureValid,
    bannedWordsFound,
  });

  // Convert markdown to HTML
  const rawHtml = await marked(blogContent);
  const contentHtml = sanitizeGeneratedHtml(
    typeof rawHtml === "string" ? rawHtml : String(rawHtml)
  );

  onProgress?.({ name: "Running quality checks", status: "complete" });

  const generationTimeMs = Date.now() - startTime;
  const summary = tracker.summary;

  return {
    blogId: "", // Set by API route after DB insert
    content: blogContent,
    contentHtml,
    title: finalTitle,
    slug: finalSlug,
    metaTitle,
    metaDescription,
    focusKeyword: input.keyword,
    archetype: input.archetype,
    wordCount,
    scores: {
      seoScore: finalSeoScore.score,
      qualityScore: qualityGates.overallScore,
      detectionRisk: finalDetection.riskLevel,
      detectionRiskScore: finalDetection.riskScore,
      burstinessScore: finalDetection.burstinessStats.standardDeviation,
      readabilityScore,
    },
    voiceMatchScore,
    generationTimeMs,
    totalCostCents: summary.totalCostCents,
    totalInputTokens: summary.totalInputTokens,
    totalOutputTokens: summary.totalOutputTokens,
    aiCalls: summary.calls,
    modelUsed: "sonnet",
    promptVersion: PROMPT_VERSION,
  };
}

/**
 * Get the text of a paragraph by index from markdown content.
 */
function getParagraphText(markdown: string, index: number): string {
  const paragraphs = extractParagraphs(markdown);
  return paragraphs[index] || "";
}

function extractParagraphIndex(location: string | undefined): number | null {
  if (!location) return null;
  const match = location.match(/^paragraph\s+(\d+)$/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function pickValidMetaTitle(
  titles: string[] | undefined,
  recommendedIndex: number | undefined,
  finalTitle: string,
  keyword: string
): string {
  const safeTitles = Array.isArray(titles)
    ? titles.filter((title): title is string => typeof title === "string" && title.trim().length > 0)
    : [];

  const prioritized: string[] = [];
  if (
    Number.isInteger(recommendedIndex) &&
    typeof recommendedIndex === "number" &&
    recommendedIndex >= 0 &&
    recommendedIndex < safeTitles.length
  ) {
    prioritized.push(safeTitles[recommendedIndex]);
  }
  prioritized.push(...safeTitles);
  prioritized.push(buildFallbackMetaTitle(finalTitle, keyword));

  for (const candidate of prioritized) {
    const trimmed = candidate.trim();
    if (!startsWithBannedMetaOpener(trimmed)) {
      return trimmed;
    }
  }

  return buildFallbackMetaTitle(finalTitle, keyword);
}

function pickValidMetaDescription(
  descriptions: string[] | undefined,
  recommendedIndex: number | undefined,
  keyword: string,
  finalTitle: string
): string {
  const safeDescriptions = Array.isArray(descriptions)
    ? descriptions.filter((desc): desc is string => typeof desc === "string" && desc.trim().length > 0)
    : [];

  const prioritized: string[] = [];
  if (
    Number.isInteger(recommendedIndex) &&
    typeof recommendedIndex === "number" &&
    recommendedIndex >= 0 &&
    recommendedIndex < safeDescriptions.length
  ) {
    prioritized.push(safeDescriptions[recommendedIndex]);
  }
  prioritized.push(...safeDescriptions);
  prioritized.push(buildFallbackMetaDescription(keyword, finalTitle));

  for (const candidate of prioritized) {
    const trimmed = candidate.trim();
    if (!startsWithBannedMetaOpener(trimmed)) {
      return trimmed;
    }
  }

  return buildFallbackMetaDescription(keyword, finalTitle);
}

function startsWithBannedMetaOpener(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return BANNED_META_OPENERS.some((opener) =>
    lower.startsWith(opener.toLowerCase())
  );
}

function buildFallbackMetaTitle(finalTitle: string, keyword: string): string {
  const base = `${keyword} Guide: ${finalTitle}`.replace(/\s+/g, " ").trim();
  return base.slice(0, 60);
}

function buildFallbackMetaDescription(keyword: string, finalTitle: string): string {
  const base = `Practical guidance on ${keyword} from "${finalTitle}". Learn key steps, avoid common mistakes, and take action with confidence.`;
  return base.slice(0, 155);
}
