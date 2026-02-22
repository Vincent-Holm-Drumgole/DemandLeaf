import type { CrawledPage, VoiceProfile, SourceQuality, AICallResult } from "@/types";
import { callSonnet, parseJsonResponse } from "@/lib/ai/client";
import { buildVoiceExtractionPrompt } from "@/lib/ai/prompts";

/**
 * Extract a voice profile from crawled website content using Sonnet.
 * Selects best content sources and assesses source quality.
 */
export async function extractVoiceProfile(
  pages: CrawledPage[],
  companyName: string
): Promise<{ profile: VoiceProfile; aiResult: AICallResult }> {
  // 1. Select best content sources (blogs preferred)
  const blogPosts = pages
    .filter((p) => p.type === "blog")
    .sort((a, b) => b.wordCount - a.wordCount);
  const aboutPage = pages.find((p) => p.type === "about");
  const homepage = pages.find((p) => p.type === "homepage");

  // 2. Assess source quality
  const sourceQuality = assessSourceQuality(blogPosts.length);

  // 3. Build content sample (cap at ~3000 words to stay within token limits)
  const contentSample = buildContentSample(blogPosts, aboutPage, homepage);

  // 4. Call Sonnet with voice extraction prompt
  const { systemPrompt, userMessage } = buildVoiceExtractionPrompt(
    companyName,
    contentSample
  );

  const aiResult = await callSonnet(systemPrompt, userMessage, {
    temperature: 0.3,
    maxTokens: 2048,
  });

  // 5. Parse and validate response
  let parsed: Partial<Omit<VoiceProfile, "sourceQuality">> = {};
  try {
    parsed = parseJsonResponse<Partial<Omit<VoiceProfile, "sourceQuality">>>(
      aiResult.content
    );
  } catch {
    // Fall back to deterministic defaults when extraction JSON is malformed.
  }

  const profile: VoiceProfile = {
    voiceDescription:
      typeof parsed.voiceDescription === "string" && parsed.voiceDescription.trim().length > 0
        ? parsed.voiceDescription.trim()
        : "Professional and clear",
    formality: clamp(toFiniteNumber(parsed.formality, 6), 1, 10),
    humor: clamp(toFiniteNumber(parsed.humor, 3), 1, 10),
    jargonLevel: clamp(toFiniteNumber(parsed.jargonLevel, 5), 1, 10),
    sentenceComplexity: clamp(toFiniteNumber(parsed.sentenceComplexity, 5), 1, 10),
    toneAttributes: toStringArray(parsed.toneAttributes, ["professional"]),
    preferredVocabulary: toStringArray(parsed.preferredVocabulary),
    avoidedVocabulary: toStringArray(parsed.avoidedVocabulary),
    writingExamples: toStringArray(parsed.writingExamples),
    sourceQuality,
  };

  return { profile, aiResult };
}

function assessSourceQuality(blogCount: number): SourceQuality {
  if (blogCount >= 5) return "strong";
  if (blogCount >= 3) return "mixed";
  if (blogCount >= 1) return "limited";
  return "none";
}

function buildContentSample(
  blogPosts: CrawledPage[],
  aboutPage: CrawledPage | undefined,
  homepage: CrawledPage | undefined
): string {
  const MAX_CHARS = 8000; // ~2000 words / ~3000 tokens
  const parts: string[] = [];
  let charCount = 0;

  // Add blog posts first (most valuable for voice)
  for (const post of blogPosts.slice(0, 5)) {
    const excerpt = post.content.slice(0, 2000);
    if (charCount + excerpt.length > MAX_CHARS) break;
    parts.push(excerpt);
    charCount += excerpt.length;
  }

  // Add about page if we have room
  if (aboutPage && charCount < MAX_CHARS) {
    const excerpt = aboutPage.content.slice(0, 1500);
    parts.push(excerpt);
    charCount += excerpt.length;
  }

  // Add homepage if we still need content
  if (parts.length === 0 && homepage) {
    parts.push(homepage.content.slice(0, 2000));
  }

  return parts.join("\n\n---\n\n");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
