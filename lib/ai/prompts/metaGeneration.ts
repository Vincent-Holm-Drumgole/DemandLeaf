export const META_GENERATION_VERSION = "v1.0";

export interface MetaGenerationResult {
  titles: string[];
  descriptions: string[];
  recommendedTitle: number;
  recommendedDescription: number;
}

const SYSTEM_PROMPT = `Generate SEO meta titles and descriptions. Return JSON with 3 options each.

Rules:
- Title: 50-60 characters, include focus keyword naturally, use a number or power word
- Description: 120-155 characters, include a hook, imply a benefit, include subtle CTA
- NEVER start with "Discover", "Unlock", "Master", or "Explore"
- NEVER use these words: delve, robust, seamless, leverage, comprehensive, holistic`;

export function buildMetaGenerationPrompt(
  keyword: string,
  blogTitle: string,
  firstParagraph: string,
  archetype: string,
  voiceAttributes: string[]
): { systemPrompt: string; userMessage: string } {
  const safeVoiceAttributes = Array.isArray(voiceAttributes)
    ? voiceAttributes.filter((attr): attr is string => typeof attr === "string" && attr.trim().length > 0)
    : [];

  return {
    systemPrompt:
      SYSTEM_PROMPT +
      `\n- Match the brand voice: ${safeVoiceAttributes.join(", ")}`,
    userMessage: `Focus keyword: ${keyword}
Blog title: ${blogTitle}
Blog opening: ${firstParagraph.slice(0, 300)}
Content type: ${archetype}

Return a JSON object:
{
  "titles": ["option1 (50-60 chars)", "option2", "option3"],
  "descriptions": ["option1 (120-155 chars)", "option2", "option3"],
  "recommendedTitle": 0,
  "recommendedDescription": 0
}`,
  };
}
