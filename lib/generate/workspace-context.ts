import type { VoiceProfile, Archetype, KBContextResult } from "@/types";
import { generateEmbedding } from "@/lib/ai/embedding";
import { selectKBContext } from "@/lib/knowledge-base/context-selector";
import { formatTrainingSignals, type TrainingSignalsPayload } from "@/lib/scorecard/training-signals";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type ConvexClient = {
  query: <T>(fn: any, args: any) => Promise<T>;
  action: <T>(fn: any, args: any) => Promise<T>;
};

/**
 * Build a VoiceProfile from the workspace voiceProfiles table shape.
 * Maps voiceAttributes + vocabularyPreferences to the flat VoiceProfile type.
 */
export function buildVoiceProfileFromWorkspace(profile: {
  voiceDescription: string;
  voiceAttributes: {
    formality: number;
    humor: number;
    jargonLevel: number;
    sentenceComplexity: number;
    toneAttributes: string[];
  };
  vocabularyPreferences?: {
    preferred: string[];
    avoid: string[];
  } | null;
  writingExamples: string[];
  sourceQuality?: string | null;
  thoughtLeadershipPositions?: string[] | null;
  brandPhilosophy?: string | null;
  editPatterns?: Array<{
    editType: string;
    frequency: number;
    examples: string[];
    suggestedAdjustment: string;
  }> | null;
}): VoiceProfile {
  const validQualities = ["strong", "mixed", "limited", "none"] as const;
  const sq = profile.sourceQuality;
  const sourceQuality: VoiceProfile["sourceQuality"] =
    typeof sq === "string" && (validQualities as readonly string[]).includes(sq)
      ? (sq as VoiceProfile["sourceQuality"])
      : "limited";

  return {
    voiceDescription: profile.voiceDescription,
    formality: profile.voiceAttributes.formality,
    humor: profile.voiceAttributes.humor,
    jargonLevel: profile.voiceAttributes.jargonLevel,
    sentenceComplexity: profile.voiceAttributes.sentenceComplexity,
    toneAttributes: profile.voiceAttributes.toneAttributes,
    preferredVocabulary: profile.vocabularyPreferences?.preferred ?? [],
    avoidedVocabulary: profile.vocabularyPreferences?.avoid ?? [],
    writingExamples: profile.writingExamples,
    sourceQuality,
    thoughtLeadershipPositions: profile.thoughtLeadershipPositions ?? undefined,
    brandPhilosophy: profile.brandPhilosophy ?? undefined,
    editPatterns: profile.editPatterns as VoiceProfile["editPatterns"],
  };
}

/**
 * Build company context string from workspace fields.
 */
export function buildCompanyContextFromWorkspace(workspace: {
  name: string;
  url?: string | null;
  industry?: string | null;
  audienceDescription?: string | null;
  masterContext?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(`Company: ${workspace.name}`);
  if (workspace.industry) parts.push(`Industry: ${workspace.industry}`);
  if (workspace.audienceDescription) parts.push(`Target audience: ${workspace.audienceDescription}`);
  if (workspace.url) parts.push(`Website: ${workspace.url}`);
  return parts.join("\n");
}

/**
 * Load KB context, never-say terms, and training signals for a workspace.
 */
export async function loadWorkspaceEnrichments(
  convex: ConvexClient,
  workspaceId: Id<"workspaces">,
  keyword: string,
  archetype: Archetype,
): Promise<{
  kbContext?: KBContextResult;
  neverSayTerms?: string[];
  trainingContext?: string;
  trainingSignals: TrainingSignalsPayload<Id<"blogs">>;
}> {
  let kbContext: KBContextResult | undefined;
  let neverSayTerms: string[] | undefined;
  let trainingContext: string | undefined;
  let trainingSignals: TrainingSignalsPayload<Id<"blogs">> = {
    fewShotExamples: [],
    suppressedTags: [],
    coachingNotes: [],
  };

  try {
    const [neverSayItems, kbEntries, scorecardSignals] = await Promise.all([
      convex.query<string[]>(api.neverSayList.getAllTerms, { workspaceId }),
      convex.query<any[]>(api.knowledgeBase.listReadyByWorkspace, { workspaceId }),
      convex.query<any>(api.scoredOutputs.getTrainingSignals, { workspaceId }),
    ]);

    if (neverSayItems.length > 0) {
      neverSayTerms = neverSayItems;
    }
    trainingSignals = scorecardSignals as TrainingSignalsPayload<Id<"blogs">>;
    trainingContext = formatTrainingSignals(trainingSignals);

    if (kbEntries.length > 0) {
      const queryEmbedding = await generateEmbedding(keyword);
      const vectorResults = await convex.action<any[]>(api.knowledgeBase.searchByEmbedding, {
        workspaceId,
        queryEmbedding,
        limit: 10,
      });
      if (vectorResults.length > 0) {
        kbContext = selectKBContext(vectorResults, archetype);
      }
    }
  } catch (enrichErr) {
    console.warn("[workspace-generate] enrichment failed, proceeding without:", enrichErr);
  }

  return { kbContext, neverSayTerms, trainingContext, trainingSignals };
}
