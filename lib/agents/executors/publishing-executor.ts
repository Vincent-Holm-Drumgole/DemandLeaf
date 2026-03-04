import { api } from "@/convex/_generated/api";
import { inngest } from "@/lib/inngest/client";
import { parseConvexId } from "@/lib/convex-id";
import { generateBlog } from "@/lib/ai/generator";
import { generateEmbedding } from "@/lib/ai/embedding";
import { selectKBContext } from "@/lib/knowledge-base/context-selector";
import { ARCHETYPES } from "@/lib/constants/archetypes";
import type {
  Archetype,
  BriefData,
  GenerationInput,
  KBContextResult,
  PublishingAgentPayload,
  VoiceProfile,
} from "@/types";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";

const QUALITY_GATE_THRESHOLD = 70;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
const MAX_CRON_KB_ITEMS = 8;

function isArchetype(value: string): value is Archetype {
  return value in ARCHETYPES;
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Number(value)));
}

function mapVoiceProfile(profile: Record<string, unknown> | null): VoiceProfile {
  const voiceAttributes =
    profile && typeof profile.voiceAttributes === "object" && profile.voiceAttributes
      ? (profile.voiceAttributes as Record<string, unknown>)
      : null;
  const vocabularyPreferences =
    profile && typeof profile.vocabularyPreferences === "object" && profile.vocabularyPreferences
      ? (profile.vocabularyPreferences as Record<string, unknown>)
      : null;

  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];

  return {
    voiceDescription:
      (typeof profile?.voiceDescription === "string" && profile.voiceDescription) ||
      "Professional and clear",
    formality: clamp(
      typeof voiceAttributes?.formality === "number" ? voiceAttributes.formality : undefined,
      1,
      10,
      5,
    ),
    humor: clamp(
      typeof voiceAttributes?.humor === "number" ? voiceAttributes.humor : undefined,
      1,
      10,
      2,
    ),
    jargonLevel: clamp(
      typeof voiceAttributes?.jargonLevel === "number" ? voiceAttributes.jargonLevel : undefined,
      1,
      10,
      4,
    ),
    sentenceComplexity: clamp(
      typeof voiceAttributes?.sentenceComplexity === "number"
        ? voiceAttributes.sentenceComplexity
        : undefined,
      1,
      10,
      5,
    ),
    toneAttributes: asStringArray(voiceAttributes?.toneAttributes),
    preferredVocabulary: asStringArray(vocabularyPreferences?.preferred),
    avoidedVocabulary: asStringArray(vocabularyPreferences?.avoid),
    writingExamples: asStringArray(profile?.writingExamples),
    sourceQuality:
      profile?.sourceQuality === "strong" ||
      profile?.sourceQuality === "mixed" ||
      profile?.sourceQuality === "limited" ||
      profile?.sourceQuality === "none"
        ? profile.sourceQuality
        : "limited",
    thoughtLeadershipPositions: asStringArray(profile?.thoughtLeadershipPositions),
    brandPhilosophy:
      typeof profile?.brandPhilosophy === "string" ? profile.brandPhilosophy : undefined,
  };
}

function buildCompanyContext(workspace: {
  name: string;
  url?: string;
  industry?: string;
  audienceDescription?: string;
}): string {
  const sections = [
    `Company: ${workspace.name}`,
    workspace.url ? `Website: ${workspace.url}` : null,
    workspace.industry ? `Industry: ${workspace.industry}` : null,
    workspace.audienceDescription ? `Audience: ${workspace.audienceDescription}` : null,
  ].filter((value): value is string => Boolean(value));
  return sections.join("\n");
}

function buildBriefHint(briefData: BriefData): GenerationInput["briefHint"] {
  const outline = briefData.outline
    .map((section) => (section.level === 2 ? `## ${section.heading}` : `### ${section.heading}`))
    .join("\n");
  return {
    outline,
    hookOptions: briefData.hookOptions,
    internalLinkOpportunities: briefData.internalLinkOpportunities,
    citationNeeds: briefData.citationNeeds,
  };
}

function buildCronKbContext(
  entries: Array<{
    _id: string;
    entryType: string;
    title: string;
    content: string;
  }>,
): KBContextResult | undefined {
  if (entries.length === 0) return undefined;
  const limited = entries.slice(0, MAX_CRON_KB_ITEMS);
  const items = limited.map((entry, index) => ({
    entryId: entry._id,
    entryType: entry.entryType as KBContextResult["items"][number]["entryType"],
    title: entry.title,
    content: entry.content,
    similarityScore: Math.max(0, 1 - index * 0.08),
  }));
  const totalChars = items.reduce((sum, item) => sum + item.title.length + item.content.length, 0);
  return {
    items,
    totalTokens: Math.ceil(totalChars / 4),
    truncated: entries.length > limited.length,
  };
}

/**
 * Execute an autonomous publishing action.
 * Generates a blog from an approved brief, applies safety gates, and optionally publishes to WP.
 *
 * Safety rails (post-generation, pre-publish):
 * - Gate A: qualityScore >= 70
 * - Gate B: No critical decay alerts in last 7 days
 * - Gate C: No publishing rejections in last 48h
 */
export async function executePublishing(
  convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  payload: PublishingAgentPayload,
  cronKey?: string
): Promise<{ blogId: string | null; published: boolean; paused: boolean }> {
  const briefId = parseConvexId(payload.briefId, "contentBriefs");
  const calendarItemId = parseConvexId(payload.calendarItemId, "contentCalendar");
  if (!briefId) {
    return { blogId: null, published: false, paused: false };
  }
  const hasCronAccess = Boolean(cronKey);

  const pauseAgent = async (reason: string): Promise<void> => {
    if (hasCronAccess && cronKey) {
      await convex.mutation(api.publishingAgentConfig.pause, {
        workspaceId,
        reason,
        cronKey,
      });
      return;
    }
    await convex.mutation(api.publishingAgentConfig.pauseByUser, {
      workspaceId,
      reason,
    });
  };

  // Verify config is active.
  const config = hasCronAccess && cronKey
    ? await convex.query(api.publishingAgentConfig.getByWorkspaceForCron, {
        workspaceId,
        cronKey,
      })
    : await convex.query(api.publishingAgentConfig.getByWorkspace, {
        workspaceId,
      });
  if (!config || config.status !== "active") {
    return { blogId: null, published: false, paused: false };
  }

  // Safety Gate B: Check for critical decay alerts in last 7 days
  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;
  const recentAlerts = hasCronAccess && cronKey
    ? await convex.query(api.decayAlerts.listByWorkspaceForCron, {
        workspaceId,
        cronKey,
      })
    : await convex.query(api.decayAlerts.listByWorkspace, {
        workspaceId,
      });
  const criticalRecent = recentAlerts.filter(
    (a: { severity: string; triggeredAt: number; status: string }) =>
      a.severity === "critical" &&
      a.triggeredAt >= sevenDaysAgo &&
      a.status !== "resolved"
  );
  if (criticalRecent.length > 0) {
    await pauseAgent("decay_alert_active");
    return { blogId: null, published: false, paused: true };
  }

  // Safety Gate C: No publishing rejections in last 48h
  const twoDaysAgo = Date.now() - TWO_DAYS_MS;
  const auditEntries = hasCronAccess && cronKey
    ? await convex.query(api.agentAuditLog.listByWorkspaceForCron, {
        workspaceId,
        cronKey,
      })
    : await convex.query(api.agentAuditLog.listByWorkspace, {
        workspaceId,
      });
  const recentRejections = auditEntries.filter(
    (e: { agentType: string; event: string; createdAt: number }) =>
      e.agentType === "publishing" &&
      e.event === "rejected" &&
      e.createdAt >= twoDaysAgo
  );
  if (recentRejections.length > 0) {
    await pauseAgent("recent_rejection");
    return { blogId: null, published: false, paused: true };
  }

  const brief = hasCronAccess && cronKey
    ? await convex.query(api.contentBriefs.getByIdForCron, {
        briefId,
        workspaceId,
        cronKey,
      })
    : await convex.query(api.contentBriefs.getById, {
        briefId,
      });
  if (!brief || brief.workspaceId !== workspaceId || brief.status !== "approved") {
    return { blogId: null, published: false, paused: false };
  }

  const workspace = hasCronAccess && cronKey
    ? await convex.query(api.workspaces.getByIdForCron, {
        workspaceId,
        cronKey,
      })
    : await convex.query(api.workspaces.getById, {
        workspaceId,
      });
  if (!workspace) {
    return { blogId: null, published: false, paused: false };
  }

  const voiceProfileRaw = hasCronAccess && cronKey
    ? await convex.query(api.voiceProfiles.getByWorkspaceForCron, {
        workspaceId,
        cronKey,
      })
    : await convex.query(api.voiceProfiles.getByWorkspace, {
        workspaceId,
      });
  const voiceProfile = mapVoiceProfile(voiceProfileRaw as Record<string, unknown> | null);

  const neverSayTerms = hasCronAccess && cronKey
    ? await convex.query(api.neverSayList.getAllTermsForCron, {
        workspaceId,
        cronKey,
      })
    : await convex.query(api.neverSayList.getAllTerms, {
        workspaceId,
      });

  const briefData = brief.briefData as BriefData;
  const keyword = (payload.keyword || briefData.targetKeyword).trim();
  if (!keyword) {
    return { blogId: null, published: false, paused: false };
  }

  const archetypeCandidate =
    payload.archetype ||
    briefData.archetypeRecommendation ||
    "how_to";
  const archetype: Archetype = isArchetype(archetypeCandidate)
    ? archetypeCandidate
    : "how_to";

  let kbContext: KBContextResult | undefined;
  try {
    if (hasCronAccess && cronKey) {
      const kbEntries = await convex.query(api.knowledgeBase.listReadyByWorkspaceForCron, {
        workspaceId,
        cronKey,
      });
      kbContext = buildCronKbContext(
        kbEntries.map((entry) => ({
          _id: entry._id,
          entryType: entry.entryType,
          title: entry.title,
          content: entry.content,
        })),
      );
    } else {
      const kbEntries = await convex.query(api.knowledgeBase.listReadyByWorkspace, {
        workspaceId,
      });
      if (kbEntries.length > 0) {
        const embedding = await generateEmbedding(keyword);
        const vectorResults = await convex.action(api.knowledgeBase.searchByEmbedding, {
          queryEmbedding: embedding,
          limit: 10,
        });
        if (vectorResults.length > 0) {
          kbContext = selectKBContext(vectorResults, archetype);
        }
      }
    }
  } catch (err) {
    console.warn("[publishing-executor] KB context load failed:", err);
  }

  const generationInput: GenerationInput = {
    keyword,
    archetype,
    voiceProfile,
    companyContext: buildCompanyContext(workspace),
    industry: workspace.industry ?? "General",
    audience: workspace.audienceDescription ?? "Business professionals",
    kbContext,
    neverSayTerms,
    briefHint: buildBriefHint(briefData),
  };

  const generated = await generateBlog(generationInput);

  const qualityPasses = generated.scores.qualityScore >= QUALITY_GATE_THRESHOLD;
  const now = Date.now();
  const status = qualityPasses ? "published" : "draft";

  const blogId = hasCronAccess && cronKey
    ? await convex.mutation(api.blogs.createForCron, {
        workspaceId,
        title: generated.title,
        slug: generated.slug,
        content: generated.content,
        contentHtml: generated.contentHtml,
        metaTitle: generated.metaTitle,
        metaDescription: generated.metaDescription,
        focusKeyword: generated.focusKeyword,
        archetype: generated.archetype,
        wordCount: generated.wordCount,
        status,
        seoScore: generated.scores.seoScore,
        qualityScore: generated.scores.qualityScore,
        detectionRisk: generated.scores.detectionRisk,
        detectionRiskScore: generated.scores.detectionRiskScore,
        burstinessScore: generated.scores.burstinessScore,
        readabilityScore: generated.scores.readabilityScore,
        modelUsed: generated.modelUsed,
        inputTokens: generated.totalInputTokens,
        outputTokens: generated.totalOutputTokens,
        generationCostCents: generated.totalCostCents,
        generationTimeMs: generated.generationTimeMs,
        promptVersion: generated.promptVersion,
        aeoScore: generated.aeoScore,
        publishedAt: qualityPasses ? now : undefined,
        cronKey,
      })
    : await convex.mutation(api.blogs.create, {
        workspaceId,
        title: generated.title,
        slug: generated.slug,
        content: generated.content,
        contentHtml: generated.contentHtml,
        metaTitle: generated.metaTitle,
        metaDescription: generated.metaDescription,
        focusKeyword: generated.focusKeyword,
        archetype: generated.archetype,
        wordCount: generated.wordCount,
        status,
        seoScore: generated.scores.seoScore,
        qualityScore: generated.scores.qualityScore,
        detectionRisk: generated.scores.detectionRisk,
        detectionRiskScore: generated.scores.detectionRiskScore,
        burstinessScore: generated.scores.burstinessScore,
        readabilityScore: generated.scores.readabilityScore,
        modelUsed: generated.modelUsed,
        inputTokens: generated.totalInputTokens,
        outputTokens: generated.totalOutputTokens,
        generationCostCents: generated.totalCostCents,
        generationTimeMs: generated.generationTimeMs,
        promptVersion: generated.promptVersion,
      });

  if (!hasCronAccess && generated.aeoScore !== undefined) {
    await convex.mutation(api.blogs.updatePublishingData, {
      blogId,
      aeoScore: generated.aeoScore,
      publishedAt: qualityPasses ? now : undefined,
    });
  }

  if (hasCronAccess && cronKey) {
    await convex.mutation(api.contentBriefs.linkBlogForCron, {
      briefId,
      blogId,
      workspaceId,
      cronKey,
    });
  } else {
    await convex.mutation(api.contentBriefs.linkBlog, {
      briefId,
      blogId,
    });
  }

  if (!qualityPasses) {
    await pauseAgent("quality_gate_failed");
    return { blogId: blogId as string, published: false, paused: true };
  }

  // Fire coordination event
  inngest
    .send({
      name: "agent/blog-published-autonomously",
      data: {
        workspaceId: workspaceId as string,
        blogId: blogId as string,
        keyword,
        calendarItemId: calendarItemId ? (calendarItemId as string) : payload.calendarItemId,
      },
    })
    .catch((err) =>
      console.warn("[publishing-executor] inngest.send failed:", err)
    );

  return { blogId: blogId as string, published: true, paused: false };
}
