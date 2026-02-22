export const VOICE_CHECK_VERSION = "v1.0";

const SYSTEM_PROMPT = `Compare the blog text against the voice profile. Rate each paragraph 1-5 for voice consistency. Only flag paragraphs scoring below 3. Return JSON only, no additional text.`;

export interface VoiceCheckFlag {
  paragraphIndex: number;
  score: number;
  reason: string;
}

export interface VoiceCheckResponse {
  flags: VoiceCheckFlag[];
  overallScore: number;
}

export function buildVoiceCheckPrompt(
  voiceProfileJson: string,
  blogText: string
): { systemPrompt: string; userMessage: string } {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `VOICE PROFILE:
${voiceProfileJson}

BLOG TEXT:
${blogText}

Rate each paragraph for voice consistency (1 = completely off-voice, 5 = perfect match).

Return a JSON object:
{
  "flags": [
    { "paragraphIndex": 0, "score": 2, "reason": "Too formal. Profile indicates casual tone." },
    ...
  ],
  "overallScore": 4.2
}

Return empty flags array if all paragraphs score 3 or above. Only include paragraphs that score BELOW 3.`,
  };
}
