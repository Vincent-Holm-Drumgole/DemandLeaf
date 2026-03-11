import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { isBillingEnabledServer } from "@/lib/billing-config";
import { api } from "@/convex/_generated/api";
import { generateBlog } from "@/lib/ai/generator";
import {
  buildVoiceProfileFromWorkspace,
  buildCompanyContextFromWorkspace,
  loadWorkspaceEnrichments,
} from "@/lib/generate/workspace-context";
import { parseConvexId } from "@/lib/convex-id";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_BRIEF_NOT_FOUND } from "@/convex/errors";
import { ARCHETYPES } from "@/lib/constants/archetypes";
import { isBriefData } from "@/lib/brief/validate";
import type { Archetype, BriefHint, BriefData, GenerateSSEEvent } from "@/types";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return jsonError("Unauthorized", 401);

  const rl = await checkRateLimit(`workspace-generate:${userId}`, { limit: 5, windowSec: 3600 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
      },
    });
  }

  let body: { keyword: string; archetype: string; briefId?: string; calendarItemId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  let keyword = body.keyword?.trim();
  let archetype = body.archetype;

  if (!keyword || keyword.length < 2) return jsonError("keyword must be at least 2 characters", 400);
  if (!archetype || !ARCHETYPES[archetype as Archetype]) {
    return jsonError(`Invalid archetype. Use one of: ${Object.keys(ARCHETYPES).join(", ")}`, 400);
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) return jsonError("Workspace not found", 404);

  // Billing gate
  if (isBillingEnabledServer()) {
    const plan = (workspace as any).plan ?? "trial";
    const trialEndsAt = (workspace as any).trialEndsAt ?? 0;
    const trialExpired = plan === "trial" && Date.now() > trialEndsAt;
    if (plan === "canceled" || plan === "past_due" || trialExpired) {
      return new Response(
        JSON.stringify({ error: "Subscription required to continue generating content.", code: "SUBSCRIPTION_REQUIRED" }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Load workspace voice profile
  const voiceProfileDoc = await convex.query(api.voiceProfiles.getByWorkspace, {
    workspaceId: workspace._id,
  });
  if (!voiceProfileDoc) {
    return jsonError("No voice profile found. Complete the Voice Builder in settings first.", 422);
  }

  const voiceProfile = buildVoiceProfileFromWorkspace(voiceProfileDoc);
  const companyContext = buildCompanyContextFromWorkspace(workspace);
  const industry = (workspace as any).industry ?? "General";
  const audience = (workspace as any).audienceDescription ?? "Business professionals";

  // Brief loading
  let briefHint: BriefHint | undefined;
  let resolvedBriefId: Id<"contentBriefs"> | undefined;

  if (body.briefId) {
    const briefIdTyped = parseConvexId(body.briefId, "contentBriefs");
    if (!briefIdTyped) return jsonError("Invalid briefId", 400);

    try {
      const brief = await convex.query(api.contentBriefs.getById, { briefId: briefIdTyped });
      if (brief.status !== "approved") return jsonError("Brief must be approved before generating", 422);
      if (!isBriefData(brief.briefData)) return jsonError("Brief data is malformed", 500);

      const briefData: BriefData = brief.briefData;
      keyword = briefData.targetKeyword;
      const recommended = briefData.archetypeRecommendation;
      if (recommended && ARCHETYPES[recommended as Archetype]) {
        archetype = recommended;
      }
      briefHint = {
        outline: briefData.outline
          .map((s) => (s.level === 2 ? `## ${s.heading}` : `### ${s.heading}`))
          .join("\n"),
        hookOptions: briefData.hookOptions,
        internalLinkOpportunities: briefData.internalLinkOpportunities,
        citationNeeds: briefData.citationNeeds,
      };
      resolvedBriefId = briefIdTyped;
    } catch (err) {
      if (hasConvexErrorCode(err, ERR_BRIEF_NOT_FOUND)) return jsonError("Brief not found", 404);
      return jsonError("Failed to load brief", 500);
    }
  }

  // Calendar item handling
  let calendarItemId: Id<"contentCalendar"> | undefined;
  if (body.calendarItemId) {
    const cid = parseConvexId(body.calendarItemId, "contentCalendar");
    if (!cid) return jsonError("Invalid calendarItemId", 400);
    calendarItemId = cid;
  }

  // Load enrichments
  const enrichments = await loadWorkspaceEnrichments(
    convex, workspace._id, keyword, archetype as Archetype,
  );

  // SSE stream
  const abortSignal = request.signal;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const closeController = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      const onAbort = () => closeController();
      abortSignal.addEventListener("abort", onAbort, { once: true });

      function sendEvent(event: GenerateSSEEvent) {
        if (abortSignal.aborted || closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        const result = await generateBlog(
          {
            keyword,
            archetype: archetype as Archetype,
            voiceProfile,
            companyContext,
            masterContext: (workspace as any).masterContext ?? undefined,
            industry,
            audience,
            kbContext: enrichments.kbContext,
            neverSayTerms: enrichments.neverSayTerms,
            trainingContext: enrichments.trainingContext,
            briefHint,
          },
          (step) => {
            if (abortSignal.aborted) throw new Error("Client disconnected");
            sendEvent({ type: "progress", step });
          },
        );

        if (abortSignal.aborted) return;

        // Persist blog to workspace
        const blogId = await convex.mutation(api.blogs.create, {
          workspaceId: workspace._id,
          title: result.title,
          slug: result.slug,
          content: result.content,
          contentHtml: result.contentHtml,
          metaTitle: result.metaTitle,
          metaDescription: result.metaDescription,
          focusKeyword: result.focusKeyword,
          archetype: result.archetype,
          contentTrack: result.contentTrack,
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

        // Log generation context
        try {
          await convex.mutation(api.scoredOutputs.logGenerationContext, {
            workspaceId: workspace._id,
            blogId,
            fewShotBlogIds: enrichments.trainingSignals.fewShotExamples.map((e) => e.blogId),
            suppressedTags: enrichments.trainingSignals.suppressedTags.map((t) => ({
              dimension: t.dimension,
              tag: t.tag,
              count: t.count,
            })),
            coachingNotes: enrichments.trainingSignals.coachingNotes,
          });
        } catch (e) {
          console.warn("[workspace-generate] generation context log failed:", e);
        }

        // Publication checks
        try {
          await convex.mutation(api.blogs.recalculatePublicationChecks, { blogId });
        } catch (e) {
          console.warn("[workspace-generate] publication check failed:", e);
        }

        // Link brief
        if (resolvedBriefId) {
          try {
            await convex.mutation(api.contentBriefs.linkBlog, { briefId: resolvedBriefId, blogId });
          } catch (e) {
            console.warn("[workspace-generate] linkBlog failed:", e);
          }
        }

        // AEO score
        if (result.aeoScore !== undefined) {
          try {
            await convex.mutation(api.blogs.updatePublishingData, { blogId, aeoScore: result.aeoScore });
          } catch (e) {
            console.warn("[workspace-generate] aeoScore persist failed:", e);
          }
        }

        // Update calendar item status
        if (calendarItemId) {
          try {
            await convex.mutation(api.contentCalendar.updateStatus, {
              calendarId: calendarItemId,
              status: "completed",
            });
          } catch (e) {
            console.warn("[workspace-generate] calendar status update failed:", e);
          }
        }

        sendEvent({
          type: "complete",
          result: {
            blogId: blogId as string,
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
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
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
