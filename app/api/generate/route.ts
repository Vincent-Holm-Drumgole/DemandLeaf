import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateBlog } from "@/lib/ai/generator";
import type { GenerateRequest, GenerateSSEEvent } from "@/types";
import type { VoiceProfile, Archetype } from "@/types";
import { ARCHETYPES } from "@/lib/constants/archetypes";

export async function POST(request: NextRequest): Promise<Response> {
  const abortSignal = request.signal;
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const sessionId = body.sessionId?.trim();
  const keyword = body.keyword?.trim();
  const archetype = body.archetype;

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "sessionId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!keyword || keyword.length < 2) {
    return new Response(
      JSON.stringify({ error: "keyword must be at least 2 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!archetype || !ARCHETYPES[archetype]) {
    return new Response(
      JSON.stringify({ error: "Invalid archetype. Use: how_to, listicle, or definitive_guide" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Load anonymous session
  const session = await prisma.anonymousSession.findUnique({
    where: { sessionToken: sessionId },
  });

  if (!session) {
    return new Response(
      JSON.stringify({ error: "Session not found. Please crawl a website first." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (session.expiresAt < new Date()) {
    await prisma.anonymousSession.delete({ where: { sessionToken: sessionId } });
    return new Response(
      JSON.stringify({ error: "Session expired. Please start over." }),
      { status: 410, headers: { "Content-Type": "application/json" } }
    );
  }

  const crawlData = session.crawlData as Record<string, unknown> | null;
  const voiceProfileData = session.voiceProfile as Record<string, unknown> | null;

  if (!crawlData || !voiceProfileData) {
    return new Response(
      JSON.stringify({ error: "Session is missing crawl or voice data" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  const voiceProfile = buildVoiceProfileFromSession(voiceProfileData);
  const companyContext = buildCompanyContext(crawlData);
  const industry = typeof crawlData.industry === "string" ? crawlData.industry : "General";
  const audience = typeof crawlData.audience === "string" ? crawlData.audience : "Business professionals";

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: GenerateSSEEvent) {
        if (abortSignal.aborted) return;
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      try {
        const result = await generateBlog(
          {
            keyword,
            archetype: archetype as Archetype,
            voiceProfile,
            companyContext,
            industry,
            audience,
          },
          (step) => {
            if (abortSignal.aborted) throw new Error("Client disconnected");
            sendEvent({ type: "progress", step });
          }
        );

        // Save blog to anonymous session — isolated so a persistence failure
        // doesn't discard a successfully generated blog.
        let persistenceWarning: string | null = null;
        try {
          await prisma.anonymousSession.update({
            where: { sessionToken: sessionId },
            data: {
              blogData: {
                blogId: result.blogId,
                content: result.content,
                contentHtml: result.contentHtml,
                title: result.title,
                slug: result.slug,
                metaTitle: result.metaTitle,
                metaDescription: result.metaDescription,
                focusKeyword: result.focusKeyword,
                archetype: result.archetype,
                wordCount: result.wordCount,
                seoScore: result.scores.seoScore,
                qualityScore: result.scores.qualityScore,
                detectionRisk: result.scores.detectionRisk,
                detectionRiskScore: result.scores.detectionRiskScore,
                burstinessScore: result.scores.burstinessScore,
                readabilityScore: result.scores.readabilityScore,
                modelUsed: result.modelUsed,
                inputTokens: result.totalInputTokens,
                outputTokens: result.totalOutputTokens,
                generationCostCents: result.totalCostCents,
                generationTimeMs: result.generationTimeMs,
                promptVersion: result.promptVersion,
              },
            },
          });
        } catch (e) {
          persistenceWarning = "Blog generated but failed to save to session";
          console.error("Failed to persist blog to session:", e);
        }

        sendEvent({
          type: "complete",
          result: {
            blogId: result.blogId,
            content: result.content,
            title: result.title,
            metaTitle: result.metaTitle,
            metaDescription: result.metaDescription,
            scores: result.scores,
            wordCount: result.wordCount,
            generationTimeMs: result.generationTimeMs,
            totalCostCents: result.totalCostCents,
            aiCalls: result.aiCalls,
          },
          warning: persistenceWarning,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        sendEvent({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function buildVoiceProfileFromSession(
  data: Record<string, unknown>
): VoiceProfile {
  return {
    voiceDescription:
      typeof data.voiceDescription === "string"
        ? data.voiceDescription
        : "Professional and clear",
    formality: clampNumber(data.formality, 1, 10, 5),
    humor: clampNumber(data.humor, 1, 10, 2),
    jargonLevel: clampNumber(data.jargonLevel, 1, 10, 4),
    sentenceComplexity: clampNumber(data.sentenceComplexity, 1, 10, 5),
    toneAttributes: toStringArray(data.toneAttributes),
    preferredVocabulary: toStringArray(data.preferredVocabulary),
    avoidedVocabulary: toStringArray(data.avoidedVocabulary),
    writingExamples: toStringArray(data.writingExamples),
    sourceQuality:
      typeof data.sourceQuality === "string" &&
      ["strong", "mixed", "limited", "none"].includes(data.sourceQuality)
        ? (data.sourceQuality as VoiceProfile["sourceQuality"])
        : "limited",
  };
}

function buildCompanyContext(crawlData: Record<string, unknown>): string {
  const parts: string[] = [];

  if (typeof crawlData.companyName === "string") {
    parts.push(`Company: ${crawlData.companyName}`);
  }
  if (typeof crawlData.industry === "string") {
    parts.push(`Industry: ${crawlData.industry}`);
  }
  if (typeof crawlData.audience === "string") {
    parts.push(`Target audience: ${crawlData.audience}`);
  }

  // Include a snippet from the about page if available
  const pages = Array.isArray(crawlData.pages) ? crawlData.pages : [];
  const aboutPage = pages.find(
    (p): p is Record<string, unknown> =>
      typeof p === "object" &&
      p !== null &&
      (p as Record<string, unknown>).type === "about"
  );
  if (aboutPage && typeof aboutPage.content === "string") {
    parts.push(`About: ${aboutPage.content.slice(0, 500)}`);
  }

  return parts.join("\n");
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
