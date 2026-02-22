export const INDUSTRY_CLASSIFICATION_VERSION = "v1.0";

const SYSTEM_PROMPT = `Classify the company into an industry and identify their target audience. Return JSON only. No explanation.`;

export interface IndustryClassificationResult {
  companyName: string;
  industry: string;
  audience: string;
  audienceExpertise: "beginner" | "intermediate" | "advanced" | "expert";
}

export function buildIndustryClassificationPrompt(
  homepageText: string,
  aboutText: string
): { systemPrompt: string; userMessage: string } {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Company website content:

HOMEPAGE:
${homepageText.slice(0, 1500)}

ABOUT PAGE:
${aboutText.slice(0, 1500)}

Return a JSON object with exactly these fields:
{
  "companyName": "detected company name",
  "industry": "specific industry (e.g. 'B2B SaaS - Marketing Automation', 'E-commerce - Fashion', 'Healthcare - Telemedicine')",
  "audience": "primary audience description (e.g. 'marketing managers at mid-market B2B companies')",
  "audienceExpertise": "beginner|intermediate|advanced|expert"
}`,
  };
}
