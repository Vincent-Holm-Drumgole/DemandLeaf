import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getConvexClient, getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { isBillingEnabledServer } from "@/lib/billing-config";
import { api } from "@/convex/_generated/api";
import { generateBlog } from "@/lib/ai/generator";
import { generateEmbedding } from "@/lib/ai/embedding";
import { selectKBContext } from "@/lib/knowledge-base/context-selector";
import type {
  Archetype,
  BriefHint,
  BriefData,
  GenerateRequest,
  GenerateSSEEvent,
  KBContextResult,
  VoiceProfile,
} from "@/types";
import { ARCHETYPES } from "@/lib/constants/archetypes";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_BRIEF_NOT_FOUND } from "@/convex/errors";
import type { Id } from "@/convex/_generated/dataModel";
import { isBriefData } from "@/lib/brief/validate";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { formatTrainingSignals, type TrainingSignalsPayload } from "@/lib/scorecard/training-signals";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`generate:${ip}`, { limit: 3, windowSec: 60 });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait before generating again." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
        },
      }
    );
  }

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
  let keyword = body.keyword?.trim();
  let archetype = body.archetype;
  const rawBriefId = body.briefId?.trim();

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
    const allowedArchetypes = Object.keys(ARCHETYPES).join(", ");
    return new Response(
      JSON.stringify({ error: `Invalid archetype. Use one of: ${allowedArchetypes}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Billing gate: authenticated workspaces with expired trial/past-due/canceled
  // plans cannot generate new content.
  const { userId } = await auth();
  const sessionCookie = request.cookies.get("dl_session")?.value?.trim();
  if (!userId && sessionCookie !== sessionId) {
    return new Response(
      JSON.stringify({
        error: "Session mismatch. Please crawl your website again before generating.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let authedConvexClient: Awaited<ReturnType<typeof getAuthedConvexClient>> | null = null;
  let authedWorkspace:
    | {
        _id: Id<"workspaces">;
        plan?: string;
        trialEndsAt?: number;
      }
    | null = null;
  if (userId) {
    authedConvexClient = await getAuthedConvexClient();
    const workspace = await requireRequestWorkspace(authedConvexClient, request);
    if (workspace) {
      authedWorkspace = workspace;
      if (workspaceNeedsUpgrade(workspace)) {
        return new Response(
          JSON.stringify({
            error: "Subscription required to continue generating content.",
            code: "SUBSCRIPTION_REQUIRED",
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }
    }
  }

  // ── Brief-mode: load approved Phase 3 brief and override keyword/archetype ──
  let briefHint: BriefHint | undefined;
  let resolvedBriefId: Id<"contentBriefs"> | undefined;

  if (rawBriefId) {
    const briefIdTyped = parseConvexId(rawBriefId, "contentBriefs");
    if (!briefIdTyped) {
      return new Response(
        JSON.stringify({ error: "Invalid briefId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication is required to generate from a brief" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      const authedConvex = authedConvexClient ?? await getAuthedConvexClient();
      authedConvexClient = authedConvex;
      const brief = await authedConvex.query(api.contentBriefs.getById, { briefId: briefIdTyped });
      if (brief.status !== "approved") {
        return new Response(
          JSON.stringify({ error: "Brief must be approved before generating" }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        );
      }
      if (!isBriefData(brief.briefData)) {
        return new Response(
          JSON.stringify({ error: "Brief data is malformed" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const briefData: BriefData = brief.briefData;
      // Override keyword and archetype from brief
      keyword = briefData.targetKeyword;
      const recommendedArchetype = briefData.archetypeRecommendation;
      if (recommendedArchetype && ARCHETYPES[recommendedArchetype as Archetype]) {
        archetype = recommendedArchetype as Archetype;
      }
      // Convert OutlineSection[] to heading string
      const outlineStr = briefData.outline
        .map((section) => (section.level === 2 ? `## ${section.heading}` : `### ${section.heading}`))
        .join("\n");
      briefHint = {
        outline: outlineStr,
        hookOptions: briefData.hookOptions,
        internalLinkOpportunities: briefData.internalLinkOpportunities,
        citationNeeds: briefData.citationNeeds,
      };
      resolvedBriefId = briefIdTyped;
    } catch (err) {
      if (hasConvexErrorCode(err, ERR_BRIEF_NOT_FOUND)) {
        return new Response(
          JSON.stringify({ error: "Brief not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to load brief" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Load anonymous session
  const convex = getConvexClient();
  const session = await convex.query(api.anonymousSessions.get, { sessionToken: sessionId });

  if (!session) {
    return new Response(
      JSON.stringify({ error: "Session not found. Please crawl a website first." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (session.expiresAt < Date.now()) {
    await convex.mutation(api.anonymousSessions.remove, { sessionToken: sessionId });
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

  // Enrich with workspace KB context + never-say list for authenticated users
  let kbContext: KBContextResult | undefined;
  let neverSayTerms: string[] | undefined;
  let trainingContext: string | undefined;
  let trainingSignals: TrainingSignalsPayload<Id<"blogs">> = {
    fewShotExamples: [],
    suppressedTags: [],
    coachingNotes: [],
  };

  try {
    if (userId) {
      const authedConvex = authedConvexClient ?? await getAuthedConvexClient();
      authedConvexClient = authedConvex;
      const workspace =
        authedWorkspace ?? await requireRequestWorkspace(authedConvex, request);
      authedWorkspace = workspace;
      if (workspace) {
        const workspaceId = workspace._id;

        const [neverSayItems, kbEntries, scorecardSignals] = await Promise.all([
          authedConvex.query(api.neverSayList.getAllTerms, { workspaceId }),
          authedConvex.query(api.knowledgeBase.listReadyByWorkspace, { workspaceId }),
          authedConvex.query(api.scoredOutputs.getTrainingSignals, { workspaceId }),
        ]);
        if (neverSayItems.length > 0) {
          neverSayTerms = neverSayItems;
        }
        trainingSignals = scorecardSignals as TrainingSignalsPayload<Id<"blogs">>;
        trainingContext = formatTrainingSignals(trainingSignals);

        if (kbEntries.length > 0) {
          const queryEmbedding = await generateEmbedding(keyword);
          const vectorResults = await authedConvex.action(api.knowledgeBase.searchByEmbedding, {
            workspaceId,
            queryEmbedding,
            limit: 10,
          });
          if (vectorResults.length > 0) {
            kbContext = selectKBContext(vectorResults, archetype as Archetype);
          }
        }
      }
    }
  } catch (enrichErr) {
    // KB enrichment is non-critical — log and continue
    console.warn("[generate] KB/never-say enrichment failed, proceeding without:", enrichErr);
  }

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const closeController = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      const onAbort = () => {
        closeController();
      };
      abortSignal.addEventListener("abort", onAbort, { once: true });

      function sendEvent(event: GenerateSSEEvent) {
        if (abortSignal.aborted || closed) return;
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
            kbContext,
            neverSayTerms,
            trainingContext,
            briefHint,
          },
          (step) => {
            if (abortSignal.aborted) throw new Error("Client disconnected");
            sendEvent({ type: "progress", step });
          }
        );

        if (abortSignal.aborted) {
          return;
        }

        // Save blog to anonymous session — isolated so a persistence failure
        // doesn't discard a successfully generated blog.
        let persistenceWarning: string | null = null;
        try {
          await convex.mutation(api.anonymousSessions.updateBlogData, {
            sessionToken: sessionId,
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
          });
        } catch (e) {
          persistenceWarning = "Blog generated but failed to save to session";
          console.error("Failed to persist blog to session:", e);
        }

        // If generation was driven by an approved Phase 3 brief, persist the blog
        // to the workspace and link it to the brief + keyword.
        if (resolvedBriefId && authedWorkspace) {
          try {
            const workspaceBlogId = await authedConvex.mutation(api.blogs.create, {
              workspaceId: authedWorkspace._id,
              title: result.title,
              slug: result.slug,
              content: result.content,
              contentHtml: result.contentHtml,
              metaTitle: result.metaTitle,
              metaDescription: result.metaDescription,
              focusKeyword: result.focusKeyword,
              archetype: result.archetype,
              wordCount: result.wordCount,
              status: "draft",
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
            });
            try {
              await authedConvex.mutation(api.scoredOutputs.logGenerationContext, {
                workspaceId: authedWorkspace._id,
                blogId: workspaceBlogId,
                fewShotBlogIds: trainingSignals.fewShotExamples.map((example) => example.blogId),
                suppressedTags: trainingSignals.suppressedTags.map((tag) => ({
                  dimension: tag.dimension,
                  tag: tag.tag,
                  count: tag.count,
                })),
                coachingNotes: trainingSignals.coachingNotes,
              });
            } catch (contextErr) {
              console.warn("[generate] generation context log failed:", contextErr);
            }
            try {
              await authedConvex.mutation(api.contentBriefs.linkBlog, {
                briefId: resolvedBriefId,
                blogId: workspaceBlogId,
              });
            } catch (linkErr) {
              console.warn("[generate] linkBlog failed:", linkErr);
            }
            // Phase 5: persist AEO score if available
            if (result.aeoScore !== undefined) {
              try {
                await authedConvex.mutation(api.blogs.updatePublishingData, {
                  blogId: workspaceBlogId,
                  aeoScore: result.aeoScore,
                });
              } catch (aeoErr) {
                console.warn("[generate] aeoScore persist failed:", aeoErr);
              }
            }
          } catch (linkErr) {
            // Non-critical — blog was generated and streamed successfully
            console.warn("[generate] Failed to link brief to workspace blog:", linkErr);
          }
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
            aeoScore: result.aeoScore ?? null,
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
        abortSignal.removeEventListener("abort", onAbort);
        closeController();
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

function workspaceNeedsUpgrade(workspace: {
  plan?: string;
  trialEndsAt?: number;
}): boolean {
  if (!isBillingEnabledServer()) {
    return false;
  }

  const plan = workspace.plan ?? "trial";
  const trialEndsAt = workspace.trialEndsAt ?? 0;
  const trialExpired = plan === "trial" && Date.now() > trialEndsAt;
  return plan === "canceled" || plan === "past_due" || trialExpired;
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
