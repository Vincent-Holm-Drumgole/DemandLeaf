import type { VoiceProfile, AICallResult } from "@/types";
import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import {
  buildVoiceCheckPrompt,
  type VoiceCheckFlag,
  type VoiceCheckResponse,
} from "@/lib/ai/prompts";

export interface VoiceCheckResult {
  flags: VoiceCheckFlag[];
  overallScore: number;
}

/**
 * Check voice adherence of generated blog content against a voice profile using Haiku.
 * Returns per-paragraph scores and flags for paragraphs scoring below 3.
 */
export async function checkVoiceAdherence(
  blogContent: string,
  voiceProfile: VoiceProfile
): Promise<{ result: VoiceCheckResult; aiResult: AICallResult }> {
  const voiceProfileJson = JSON.stringify(
    {
      voiceDescription: voiceProfile.voiceDescription,
      formality: voiceProfile.formality,
      humor: voiceProfile.humor,
      jargonLevel: voiceProfile.jargonLevel,
      sentenceComplexity: voiceProfile.sentenceComplexity,
      toneAttributes: voiceProfile.toneAttributes,
      preferredVocabulary: voiceProfile.preferredVocabulary,
      avoidedVocabulary: voiceProfile.avoidedVocabulary,
    },
    null,
    2
  );

  const { systemPrompt, userMessage } = buildVoiceCheckPrompt(
    voiceProfileJson,
    blogContent
  );

  const aiResult = await callHaiku(systemPrompt, userMessage, {
    temperature: 0.2,
    maxTokens: 2048,
  });

  let parsed: Partial<VoiceCheckResponse> = {};
  try {
    parsed = parseJsonResponse<Partial<VoiceCheckResponse>>(aiResult.content);
  } catch {
    parsed = { flags: [], overallScore: 4 };
  }

  return {
    result: {
      flags: (Array.isArray(parsed.flags) ? parsed.flags : []).filter((f) => f.score < 3),
      overallScore:
        typeof parsed.overallScore === "number" && Number.isFinite(parsed.overallScore)
          ? parsed.overallScore
          : 4.0,
    },
    aiResult,
  };
}
