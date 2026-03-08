import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { generateBlog } from "@/lib/ai/generator";
import type { GenerationInput, VoiceProfile } from "@/types";
import { generateEmbedding } from "@/lib/ai/embedding";
import { selectKBContext } from "@/lib/knowledge-base/context-selector";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeSourceQuality(value: unknown): VoiceProfile["sourceQuality"] {
  return typeof value === "string" &&
    ["strong", "mixed", "limited", "none"].includes(value)
    ? (value as VoiceProfile["sourceQuality"])
    : "limited";
}

function toVoiceProfile(profile: unknown): VoiceProfile {
  const profileRecord = isRecord(profile) ? profile : null;
  const voiceAttributes = isRecord(profileRecord?.voiceAttributes)
    ? profileRecord.voiceAttributes
    : null;
  const vocabularyPreferences = isRecord(profileRecord?.vocabularyPreferences)
    ? profileRecord.vocabularyPreferences
    : null;
  return {
    voiceDescription:
      typeof profileRecord?.voiceDescription === "string"
        ? profileRecord.voiceDescription
        : "Clear, practitioner-level, credible.",
    formality: typeof voiceAttributes?.formality === "number" ? voiceAttributes.formality : 6,
    humor: typeof voiceAttributes?.humor === "number" ? voiceAttributes.humor : 2,
    jargonLevel: typeof voiceAttributes?.jargonLevel === "number" ? voiceAttributes.jargonLevel : 6,
    sentenceComplexity:
      typeof voiceAttributes?.sentenceComplexity === "number"
        ? voiceAttributes.sentenceComplexity
        : 6,
    toneAttributes: asStringArray(voiceAttributes?.toneAttributes),
    preferredVocabulary: asStringArray(vocabularyPreferences?.preferred),
    avoidedVocabulary: asStringArray(vocabularyPreferences?.avoid),
    writingExamples: asStringArray(profileRecord?.writingExamples),
    sourceQuality: normalizeSourceQuality(profileRecord?.sourceQuality),
    thoughtLeadershipPositions: asStringArray(profileRecord?.thoughtLeadershipPositions),
    brandPhilosophy:
      typeof profileRecord?.brandPhilosophy === "string"
        ? profileRecord.brandPhilosophy
        : undefined,
  };
}

function buildCompanyContext(workspace: {
  name: string;
  url?: string;
  industry?: string;
  audienceDescription?: string;
}): string {
  return [
    `Company: ${workspace.name}`,
    workspace.url ? `Website: ${workspace.url}` : null,
    workspace.industry ? `Industry: ${workspace.industry}` : null,
    workspace.audienceDescription ? `Audience: ${workspace.audienceDescription}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

export async function POST(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const briefId = parseConvexId(id, "researchBriefs");
  if (!briefId) {
    return NextResponse.json({ error: "Invalid brief ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const dashboard = await convex.query(api.research.listDashboard, {
    workspaceId: workspace._id,
  });
  const brief = dashboard.briefs.find((item) => item._id === briefId);
  if (!brief) {
    return NextResponse.json({ error: "Research brief not found" }, { status: 404 });
  }

  const [voiceProfileDoc, kbEntries] = await Promise.all([
    convex.query(api.voiceProfiles.getByWorkspace, { workspaceId: workspace._id }),
    convex.query(api.knowledgeBase.listReadyByWorkspace, { workspaceId: workspace._id }),
  ]);

  let kbContext: GenerationInput["kbContext"];
  if (kbEntries.length > 0) {
    const queryEmbedding = await generateEmbedding(
      `${brief.title}\n${brief.summary}\n${brief.suggestedAngle}`,
    );
    const vectorResults = await convex.action(api.knowledgeBase.searchByEmbedding, {
      workspaceId: workspace._id,
      queryEmbedding,
      limit: 10,
    });
    kbContext = selectKBContext(vectorResults, "news_commentary");
  }

  const generationInput: GenerationInput = {
    keyword: brief.keywords[0] ?? brief.title,
    archetype: "news_commentary",
    contentTrack: "research",
    voiceProfile: toVoiceProfile(voiceProfileDoc),
    companyContext: buildCompanyContext(workspace),
    masterContext: workspace.masterContext,
    industry: workspace.industry ?? "Marketing operations",
    audience: workspace.audienceDescription ?? "Marketing operations professionals",
    kbContext,
    briefHint: {
      outline: [
        "## What changed",
        "## Who it affects",
        "## Why it matters for practitioners",
        "## Aldwin's perspective",
        "## What to do next",
      ].join("\n"),
      hookOptions: [brief.title, brief.suggestedAngle],
      citationNeeds: `Use and attribute these sources naturally: ${brief.sourceNames.map((name, index) => `${name} (${brief.sourceUrls[index] ?? "source URL unavailable"})`).join("; ")}`,
      internalLinkOpportunities: [],
    },
  };

  const generated = await generateBlog(generationInput);

  const blogId = await convex.mutation(api.blogs.create, {
    workspaceId: workspace._id,
    title: generated.title,
    slug: generated.slug,
    content: generated.content,
    contentHtml: generated.contentHtml,
    metaTitle: generated.metaTitle,
    metaDescription: generated.metaDescription,
    focusKeyword: generated.focusKeyword,
    archetype: generated.archetype,
    contentTrack: "research",
    wordCount: generated.wordCount,
    status: "draft",
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

  await convex.mutation(api.blogs.recalculatePublicationChecks, { blogId });

  return NextResponse.json({ blogId }, { status: 201 });
}
