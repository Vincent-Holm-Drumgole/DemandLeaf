export const VOICE_EXTRACTION_VERSION = "v1.0";

const SYSTEM_PROMPT = `You are a brand voice analyst. Analyze the provided writing samples and extract a detailed voice profile. Be specific and precise in your analysis.

Do NOT use these words in your analysis: delve, robust, seamless, leverage, comprehensive, holistic, nuanced, multifaceted, paradigm, synergy.

Return your analysis as a JSON object. No additional text or explanation.`;

export function buildVoiceExtractionPrompt(
  companyName: string,
  contentSample: string
): { systemPrompt: string; userMessage: string } {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Analyze the following content from ${companyName}'s website and extract their brand voice profile.

CONTENT SAMPLES:
${contentSample}

Return a JSON object with exactly these fields:
{
  "voiceDescription": "2-3 sentence natural language description of the voice",
  "formality": <1-10, where 1=very casual and 10=very formal>,
  "humor": <1-10, where 1=never uses humor and 10=constant humor>,
  "jargonLevel": <1-10, where 1=always plain language and 10=highly technical>,
  "sentenceComplexity": <1-10, where 1=very simple sentences and 10=complex academic sentences>,
  "toneAttributes": ["3-5 specific tone attributes like confident, approachable, etc."],
  "preferredVocabulary": ["10-15 words this brand tends to use"],
  "avoidedVocabulary": ["5-10 words this brand avoids"],
  "writingExamples": ["2-3 example paragraphs from the content that best represent the voice"]
}`,
  };
}
