import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { crawlWebsite } from "@/lib/crawler/crawler";
import { extractVoiceProfile } from "@/lib/voice/extract";
import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import {
  buildIndustryClassificationPrompt,
  type IndustryClassificationResult,
} from "@/lib/ai/prompts/industryClassification";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { CrawlRequest, CrawlResponse } from "@/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`crawl:${ip}`, { limit: 5, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before crawling again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) },
      }
    );
  }

  let body: CrawlRequest;
  try {
    body = (await request.json()) as CrawlRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json(
      { error: "URL is required" },
      { status: 400 }
    );
  }

  // Step 1: Crawl the website
  const crawlResult = await crawlWebsite(url);

  if ("code" in crawlResult) {
    return NextResponse.json(
      { error: crawlResult.message, code: crawlResult.code },
      { status: 422 }
    );
  }

  if (crawlResult.pages.length === 0) {
    return NextResponse.json(
      { error: "No content could be extracted from this website", code: "spa" },
      { status: 422 }
    );
  }

  // Step 2: Classify industry (Haiku) + Extract voice (Sonnet) in parallel
  const homepageText =
    crawlResult.pages.find((p) => p.type === "homepage")?.content ?? "";
  const aboutText =
    crawlResult.pages.find((p) => p.type === "about")?.content ?? "";

  let industryResult: IndustryClassificationResult;
  let voiceResult: Awaited<ReturnType<typeof extractVoiceProfile>>;
  try {
    [industryResult, voiceResult] = await Promise.all([
      classifyIndustry(homepageText, aboutText, crawlResult.companyName),
      extractVoiceProfile(crawlResult.pages, crawlResult.companyName),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[crawl] AI analysis failed:", message);
    return NextResponse.json(
      { error: "AI analysis temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }

  // Step 3: Create anonymous session with all crawl data
  const sessionToken = randomUUID();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  const convex = getConvexClient();
  await convex.mutation(api.anonymousSessions.create, {
    sessionToken,
    crawlData: {
      url,
      pages: crawlResult.pages.map((p) => ({
        url: p.url,
        type: p.type,
        title: p.title,
        content: p.content,
        wordCount: p.wordCount,
      })),
      companyName: crawlResult.companyName,
      industry: industryResult.industry,
      audience: industryResult.audience,
      audienceExpertise: industryResult.audienceExpertise,
    },
    voiceProfile: voiceResult.profile,
    expiresAt,
  });

  const response: CrawlResponse = {
    sessionId: sessionToken,
    companyName: crawlResult.companyName,
    industry: industryResult.industry,
    audience: industryResult.audience,
    audienceExpertise: industryResult.audienceExpertise,
    voiceProfile: {
      description: voiceResult.profile.voiceDescription,
      sourceQuality: voiceResult.profile.sourceQuality,
      toneAttributes: voiceResult.profile.toneAttributes,
    },
    pagesFound: crawlResult.pages.length,
  };

  const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Set-Cookie": `dl_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}; Max-Age=${maxAge}`,
    },
  });
}

async function classifyIndustry(
  homepageText: string,
  aboutText: string,
  companyName: string
): Promise<IndustryClassificationResult> {
  const fallback: IndustryClassificationResult = {
    companyName,
    industry: "General Business",
    audience: "Business professionals",
    audienceExpertise: "intermediate",
  };

  try {
    const { systemPrompt, userMessage } =
      buildIndustryClassificationPrompt(homepageText, aboutText);

    const result = await callHaiku(systemPrompt, userMessage, {
      temperature: 0.3,
      maxTokens: 512,
    });

    const parsed = parseJsonResponse<Partial<IndustryClassificationResult>>(
      result.content
    );

    return {
      companyName:
        typeof parsed.companyName === "string" && parsed.companyName.trim().length > 0
          ? parsed.companyName.trim()
          : companyName,
      industry:
        typeof parsed.industry === "string" && parsed.industry.trim().length > 0
          ? parsed.industry.trim()
          : fallback.industry,
      audience:
        typeof parsed.audience === "string" && parsed.audience.trim().length > 0
          ? parsed.audience.trim()
          : fallback.audience,
      audienceExpertise:
        typeof parsed.audienceExpertise === "string" &&
        ["beginner", "intermediate", "advanced", "expert"].includes(parsed.audienceExpertise)
          ? (parsed.audienceExpertise as IndustryClassificationResult["audienceExpertise"])
          : fallback.audienceExpertise,
    };
  } catch {
    return fallback;
  }
}
