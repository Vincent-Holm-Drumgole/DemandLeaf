import "server-only";

import type { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { enrichKeywordRecords } from "@/lib/strategy/keyword-enrichment";
import type { KBEntryType } from "@/types/knowledge-base";
import type { SearchIntent } from "@/types";

export interface ImportPayload {
  strategyName: string;
  businessOutcomes: string;
  targetAudience: string;
  seedKeywords: string[];
  masterContext: string;
  competitors: { domain: string; trackedKeywords: string[] }[];
  thoughtLeadershipPositions: string[];
  neverSayTerms: string[];
  knowledgeBaseEntries: {
    title: string;
    content: string;
    entryType: KBEntryType;
    tags: string[];
  }[];
  pillars: {
    name: string;
    keywords: {
      keyword: string;
      archetype: string;
      contentTrack: "evergreen" | "research" | "thought_leadership";
      searchVolume?: number;
      keywordDifficulty?: number;
      cpc?: number;
      searchIntent?: SearchIntent;
      opportunityScore?: number;
    }[];
  }[];
  publishSchedule: {
    postsPerWeek: number;
    startDate: string;
  };
}

export interface ImportResult {
  strategyId: string;
  results: Record<string, unknown>;
}

export async function executeStrategyImport(
  convex: ConvexHttpClient,
  workspaceId: Id<"workspaces">,
  body: ImportPayload,
): Promise<ImportResult> {
  const results: Record<string, unknown> = {};

  // 1. Find or create strategy
  const strategies = await convex.query(api.strategies.listByWorkspace, { workspaceId });
  const activeStrategy = strategies.find((s) => s.status === "active");

  let strategyId: Id<"strategies">;
  if (activeStrategy) {
    strategyId = activeStrategy._id;
    await convex.mutation(api.strategies.clearDiscoveryData, { strategyId });
    await convex.mutation(api.strategies.update, {
      strategyId,
      name: body.strategyName,
      businessOutcomes: body.businessOutcomes,
      targetAudience: body.targetAudience,
      seedKeywords: body.seedKeywords,
    });
    results.strategy = "updated";
  } else {
    strategyId = await convex.mutation(api.strategies.create, {
      workspaceId,
      name: body.strategyName,
      businessOutcomes: body.businessOutcomes,
      targetAudience: body.targetAudience,
      seedKeywords: body.seedKeywords,
    });
    results.strategy = "created";
  }
  results.strategyId = strategyId;

  // 2. Update master context
  if (body.masterContext) {
    await convex.mutation(api.workspaces.updateProfile, {
      workspaceId,
      masterContext: body.masterContext,
    });
    results.masterContext = "updated";
  }

  // 3. Replace competitor tracking
  if (body.competitors?.length) {
    const competitorSwap = await convex.mutation(api.competitorTracking.replaceByStrategy, {
      workspaceId,
      strategyId,
      competitors: body.competitors,
    });
    results.competitors = `replaced ${competitorSwap.removed} with ${competitorSwap.created}`;
  }

  // 4. Update voice profile (thought leadership positions)
  if (body.thoughtLeadershipPositions?.length) {
    const existingVoice = await convex.query(api.voiceProfiles.getByWorkspace, { workspaceId });
    await convex.mutation(api.voiceProfiles.updateFromWizard, {
      workspaceId,
      patch: {
        voiceDescription: existingVoice?.voiceDescription ?? "Direct, technical, conversational. Practitioner authority.",
        formality: existingVoice?.voiceAttributes?.formality ?? 6,
        humor: existingVoice?.voiceAttributes?.humor ?? 3,
        jargonLevel: existingVoice?.voiceAttributes?.jargonLevel ?? 7,
        sentenceComplexity: existingVoice?.voiceAttributes?.sentenceComplexity ?? 5,
        toneAttributes: existingVoice?.voiceAttributes?.toneAttributes ?? ["direct", "technical", "conversational"],
        preferredVocabulary: existingVoice?.vocabularyPreferences?.preferred ?? [],
        avoidedVocabulary: existingVoice?.vocabularyPreferences?.avoid ?? [],
        writingExamples: existingVoice?.writingExamples ?? [],
        sourceQuality: existingVoice?.sourceQuality ?? "practitioner",
        thoughtLeadershipPositions: body.thoughtLeadershipPositions,
        brandPhilosophy: existingVoice?.brandPhilosophy ?? "Every piece of content should teach the reader something specific they can act on today.",
      },
    });
    results.thoughtLeadership = `set ${body.thoughtLeadershipPositions.length} positions`;
  }

  // 5. Sync never-say list
  if (body.neverSayTerms?.length) {
    const existingTerms = await convex.query(api.neverSayList.listByWorkspace, { workspaceId });
    for (const entry of existingTerms) {
      await convex.mutation(api.neverSayList.remove, { entryId: entry._id, workspaceId });
    }
    for (const term of body.neverSayTerms) {
      await convex.mutation(api.neverSayList.add, {
        workspaceId,
        term,
        termType: "word",
      });
    }
    results.neverSay = `replaced ${existingTerms.length} with ${body.neverSayTerms.length}`;
  }

  // 6. Add KB entries
  if (body.knowledgeBaseEntries?.length) {
    await convex.mutation(api.knowledgeBase.createMany, {
      workspaceId,
      entries: body.knowledgeBaseEntries.map((entry) => ({
        entryType: entry.entryType,
        title: entry.title,
        content: entry.content,
        tags: entry.tags,
      })),
    });
    results.knowledgeBase = `added ${body.knowledgeBaseEntries.length} entries`;
  }

  // 7. Create keywords from pillars
  if (body.pillars?.length) {
    const allKeywords = body.pillars.flatMap((p) => p.keywords.map((k) => k.keyword));
    const keywordSeeds = new Map<
      string,
      {
        keyword: string;
        searchVolume?: number;
        keywordDifficulty?: number;
        cpc?: number;
        searchIntent?: SearchIntent;
        opportunityScore?: number;
      }
    >();
    for (const pillar of body.pillars) {
      for (const keyword of pillar.keywords) {
        const normalizedKeyword = keyword.keyword.toLowerCase().trim();
        if (!normalizedKeyword) continue;
        keywordSeeds.set(normalizedKeyword, {
          keyword: keyword.keyword,
          searchVolume: keyword.searchVolume,
          keywordDifficulty: keyword.keywordDifficulty,
          cpc: keyword.cpc,
          searchIntent: keyword.searchIntent,
          opportunityScore: keyword.opportunityScore,
        });
      }
    }
    const keywordIds = await convex.mutation(api.keywords.bulkCreate, {
      workspaceId,
      strategyId,
      keywords: allKeywords,
    });

    const keywordMap = new Map<string, Id<"keywords">>();
    for (let i = 0; i < allKeywords.length; i++) {
      const keywordId = keywordIds[i];
      if (!keywordId) continue;
      keywordMap.set(allKeywords[i].toLowerCase().trim(), keywordId);
    }

    const keywordEnrichment = await enrichKeywordRecords(
      convex,
      Array.from(keywordMap.entries()).map(([normalizedKeyword, keywordId]) => ({
        keywordId,
        ...(keywordSeeds.get(normalizedKeyword) ?? { keyword: normalizedKeyword }),
      })),
    );
    results.keywordData = `updated ${keywordEnrichment.updated} keywords`;
    if (keywordEnrichment.failures > 0) {
      results.keywordDataFailures = keywordEnrichment.failures;
    }

    // 8. Create topic clusters (pillars)
    const clusterIds = await convex.mutation(api.topicClusters.bulkCreate, {
      workspaceId,
      strategyId,
      clusters: body.pillars.map((p) => ({
        name: p.name,
        pillarKeyword: p.keywords[0]?.keyword ?? p.name,
      })),
    });

    for (let ci = 0; ci < body.pillars.length; ci++) {
      const pillar = body.pillars[ci];
      const clusterId = clusterIds[ci];
      for (const kw of pillar.keywords) {
        const kwId = keywordMap.get(kw.keyword.toLowerCase().trim());
        if (kwId && clusterId) {
          await convex.mutation(api.keywords.updateCluster, {
            keywordId: kwId,
            clusterId,
          });
        }
      }
    }

    // 9. Create content calendar
    const startDate = new Date(body.publishSchedule?.startDate ?? new Date().toISOString());
    const postsPerWeek = body.publishSchedule?.postsPerWeek ?? 2;

    const calendarItems: Array<{
      keywordId: Id<"keywords">;
      scheduledDate: number;
      archetype: string;
      contentTrack: "evergreen" | "research" | "thought_leadership";
      priority: number;
    }> = [];

    let articleIndex = 0;
    for (const pillar of body.pillars) {
      for (const kw of pillar.keywords) {
        const kwId = keywordMap.get(kw.keyword.toLowerCase().trim());
        if (!kwId) continue;

        const weekOffset = Math.floor(articleIndex / postsPerWeek);
        const dayInWeek = (articleIndex % postsPerWeek) * Math.floor(7 / postsPerWeek);
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + weekOffset * 7 + dayInWeek);

        calendarItems.push({
          keywordId: kwId,
          scheduledDate: scheduledDate.getTime(),
          archetype: kw.archetype || "how_to",
          contentTrack: kw.contentTrack || "evergreen",
          priority: articleIndex + 1,
        });
        articleIndex++;
      }
    }

    if (calendarItems.length > 0) {
      await convex.mutation(api.contentCalendar.bulkCreate, {
        workspaceId,
        strategyId,
        items: calendarItems,
      });
    }

    results.pillars = `created ${body.pillars.length} pillars`;
    results.keywords = `created ${allKeywords.length} keywords`;
    results.calendar = `scheduled ${calendarItems.length} articles`;
  }

  return { strategyId, results };
}
