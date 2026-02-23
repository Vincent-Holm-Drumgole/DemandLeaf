import type { VoiceProfile } from "@/types";

export const CALIBRATION_VERSION = "v1.0";

/**
 * Prompt for generating 3 calibration sample paragraphs.
 *
 * Each sample subtly varies the voice interpretation to help the user
 * identify which register they prefer. Claude returns JSON.
 */
export function buildCalibrationSamplesPrompt(
  voiceProfile: VoiceProfile,
  topic = "the future of content marketing"
): { systemPrompt: string; userMessage: string } {
  const formality = voiceProfile.formality;
  const humor = voiceProfile.humor;
  const jargon = voiceProfile.jargonLevel;

  const systemPrompt = `You are a writing calibration assistant. Your job is to generate exactly 3 short sample paragraphs (each 60–100 words) on the same topic, each with subtly different voice characteristics. The user will rate each sample to help calibrate their brand voice profile.

VOICE PROFILE:
- Voice description: ${sanitizePromptInput(voiceProfile.voiceDescription)}
- Formality: ${formality}/10 (1=very casual, 10=very formal)
- Humor: ${humor}/10 (1=serious, 10=very playful)
- Jargon level: ${jargon}/10 (1=plain language, 10=highly technical)
- Tone attributes: ${voiceProfile.toneAttributes?.map(sanitizePromptInput).join(", ") || "none specified"}

Generate 3 samples:
- Sample 1: Matches the profile closely (baseline)
- Sample 2: Slightly more casual and conversational than the profile
- Sample 3: Slightly more authoritative and formal than the profile

Return valid JSON only, no prose:
{
  "samples": [
    { "id": 1, "variant": "baseline", "text": "..." },
    { "id": 2, "variant": "casual", "text": "..." },
    { "id": 3, "variant": "authoritative", "text": "..." }
  ]
}`;

  const userMessage = `Topic: ${sanitizePromptInput(topic)}

Generate 3 calibration paragraphs following the instructions above. Return JSON only.`;

  return { systemPrompt, userMessage };
}

function sanitizePromptInput(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```/g, "\\`\\`\\`");
}
