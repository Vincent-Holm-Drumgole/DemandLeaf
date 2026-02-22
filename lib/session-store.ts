import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Archetype } from "@/types";
import { Prisma } from "@/lib/generated/prisma";

const DEFAULT_SESSION_TTL_HOURS = 24;
const VALID_ARCHETYPES: Archetype[] = ["how_to", "listicle", "definitive_guide"];

export interface AnonymousSessionPayload {
  crawlData?: unknown;
  voiceProfile?: unknown;
  blogData?: unknown;
  expiresInHours?: number;
}

export async function createAnonymousSession(
  payload: AnonymousSessionPayload
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = randomUUID();
  const expiresAt = new Date(
    Date.now() +
      (payload.expiresInHours ?? DEFAULT_SESSION_TTL_HOURS) * 60 * 60 * 1000
  );

  await prisma.anonymousSession.create({
    data: {
      sessionToken,
      crawlData: toNullableJsonValue(payload.crawlData),
      voiceProfile: toNullableJsonValue(payload.voiceProfile),
      blogData: toNullableJsonValue(payload.blogData),
      expiresAt,
    },
  });

  return { sessionToken, expiresAt };
}

export async function migrateAnonymousSessionToWorkspace(params: {
  sessionToken: string;
  workspaceId: string;
}): Promise<{ migrated: boolean; reason?: string }> {
  const session = await prisma.anonymousSession.findUnique({
    where: { sessionToken: params.sessionToken },
  });

  if (!session) {
    return { migrated: false, reason: "not_found" };
  }

  if (session.expiresAt < new Date()) {
    await prisma.anonymousSession.delete({ where: { sessionToken: params.sessionToken } });
    return { migrated: false, reason: "expired" };
  }

  const crawlData = asRecord(session.crawlData);
  const voiceProfile = asRecord(session.voiceProfile);
  const blogData = asRecord(session.blogData);

  await prisma.$transaction(async (tx) => {
    const workspaceUpdate: Record<string, unknown> = {};

    if (typeof crawlData?.url === "string") {
      workspaceUpdate.url = crawlData.url;
    }
    if (typeof crawlData?.industry === "string") {
      workspaceUpdate.industry = crawlData.industry;
    }
    if (typeof crawlData?.audience === "string") {
      workspaceUpdate.audienceDescription = crawlData.audience;
    }

    if (Object.keys(workspaceUpdate).length > 0) {
      await tx.workspace.update({
        where: { id: params.workspaceId },
        data: workspaceUpdate,
      });
    }

    const pages = Array.isArray(crawlData?.pages) ? crawlData.pages : [];
    if (pages.length > 0) {
      const crawledPageRecords = pages
        .map((page) => toCrawledPageRecord(page, params.workspaceId))
        .filter((page): page is NonNullable<typeof page> => page !== null);

      if (crawledPageRecords.length > 0) {
        await tx.crawledPage.createMany({
          data: crawledPageRecords,
        });
      }
    }

    if (voiceProfile) {
      await tx.voiceProfile.create({
        data: {
          workspaceId: params.workspaceId,
          voiceAttributes: toRequiredJsonValue({
            formality: toSafeNumber(voiceProfile.formality),
            humor: toSafeNumber(voiceProfile.humor),
            jargonLevel: toSafeNumber(voiceProfile.jargonLevel),
            sentenceComplexity: toSafeNumber(voiceProfile.sentenceComplexity),
            toneAttributes: toStringArray(voiceProfile.toneAttributes),
          }),
          voiceDescription:
            typeof voiceProfile.voiceDescription === "string"
              ? voiceProfile.voiceDescription
              : "Professional and clear",
          vocabularyPreferences: toNullableJsonValue({
            preferred: toStringArray(voiceProfile.preferredVocabulary),
            avoid: toStringArray(voiceProfile.avoidedVocabulary),
          }),
          writingExamples: toStringArray(voiceProfile.writingExamples),
          sourceQuality:
            typeof voiceProfile.sourceQuality === "string"
              ? voiceProfile.sourceQuality
              : "limited",
        },
      });
    }

    if (blogData && typeof blogData.content === "string" && blogData.content.trim().length > 0) {
      const archetype = toArchetype(blogData.archetype);
      await tx.blog.create({
        data: {
          workspaceId: params.workspaceId,
          title:
            typeof blogData.title === "string" && blogData.title.trim().length > 0
              ? blogData.title.trim()
              : "Imported Draft",
          slug:
            typeof blogData.slug === "string" && blogData.slug.trim().length > 0
              ? blogData.slug.trim()
              : null,
          content: blogData.content,
          contentHtml:
            typeof blogData.contentHtml === "string" ? blogData.contentHtml : null,
          metaTitle: typeof blogData.metaTitle === "string" ? blogData.metaTitle : null,
          metaDescription:
            typeof blogData.metaDescription === "string" ? blogData.metaDescription : null,
          focusKeyword:
            typeof blogData.focusKeyword === "string" ? blogData.focusKeyword : null,
          archetype,
          wordCount: toSafeNumber(blogData.wordCount),
          status: "draft",
          seoScore: toSafeNumber(blogData.seoScore),
          qualityScore: toSafeNumber(blogData.qualityScore),
          detectionRisk:
            typeof blogData.detectionRisk === "string" ? blogData.detectionRisk : null,
          detectionRiskScore: toSafeNumber(blogData.detectionRiskScore),
          burstinessScore:
            typeof blogData.burstinessScore === "number"
              ? blogData.burstinessScore
              : null,
          readabilityScore:
            typeof blogData.readabilityScore === "number"
              ? blogData.readabilityScore
              : null,
          modelUsed:
            typeof blogData.modelUsed === "string" ? blogData.modelUsed : "sonnet",
          inputTokens: toSafeNumber(blogData.inputTokens),
          outputTokens: toSafeNumber(blogData.outputTokens),
          generationCostCents: toSafeNumber(blogData.generationCostCents),
          generationTimeMs: toSafeNumber(blogData.generationTimeMs),
          promptVersion:
            typeof blogData.promptVersion === "string" ? blogData.promptVersion : null,
        },
      });
    }

    await tx.anonymousSession.delete({
      where: { sessionToken: params.sessionToken },
    });
  });

  return { migrated: true };
}

function toCrawledPageRecord(
  value: unknown,
  workspaceId: string
): {
  workspaceId: string;
  url: string;
  pageType: string | null;
  title: string | null;
  content: string | null;
  wordCount: number | null;
} | null {
  const page = asRecord(value);
  if (!page || typeof page.url !== "string") {
    return null;
  }

  return {
    workspaceId,
    url: page.url,
    pageType: typeof page.type === "string" ? page.type : null,
    title: typeof page.title === "string" ? page.title : null,
    content: typeof page.content === "string" ? page.content : null,
    wordCount: toSafeNumber(page.wordCount),
  };
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function toArchetype(value: unknown): Archetype {
  if (typeof value === "string" && VALID_ARCHETYPES.includes(value as Archetype)) {
    return value as Archetype;
  }
  return "how_to";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toRequiredJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return {};
  }
  return value as Prisma.InputJsonValue;
}

function toNullableJsonValue(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}
