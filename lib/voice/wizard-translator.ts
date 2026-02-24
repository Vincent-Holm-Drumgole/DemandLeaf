import type { VoiceProfile } from "@/types";

export interface WizardStep1Answers {
  dinnerPartyDescription: string;      // How they'd describe their brand at a dinner party
  brandsAdmired: string[];             // 1–3 brand names they admire
  nonNegotiables: string[];            // e.g. ["contractions_ok", "humor_ok", "technical_ok"]
  brandPersonalityWords: string[];     // 3 words describing brand personality
}

export interface WizardStep2Answers {
  formality: number;           // 1-10 slider
  humor: number;               // 1-10 slider
  jargonLevel: number;         // 1-10 slider
  sentenceComplexity: number;  // 1-10 slider
  thoughtLeadershipPositions: string[]; // 1-5 POV bullet points
  brandPhilosophy: string;     // single paragraph
}

const NON_NEGOTIABLE_TONE_MAP: Record<string, string> = {
  contractions_ok: "conversational",
  humor_ok: "playful",
  technical_ok: "technical",
  empathetic: "empathetic",
  direct: "direct",
  storytelling: "story-driven",
};

/**
 * Translate wizard step 1 and step 2 answers into a partial VoiceProfile
 * that can be patched onto the existing voiceProfiles Convex record.
 */
export function translateWizardToProfile(
  step1: WizardStep1Answers,
  step2: WizardStep2Answers,
  existing: Partial<VoiceProfile>
): Partial<VoiceProfile> {
  // Derive toneAttributes from non-negotiables + brand personality
  const toneFromNonNeg = step1.nonNegotiables
    .map((k) => NON_NEGOTIABLE_TONE_MAP[k])
    .filter(Boolean);
  const toneAttributes = Array.from(
    new Set([...toneFromNonNeg, ...step1.brandPersonalityWords])
  );

  // Build a fresh voiceDescription from wizard answers
  const voiceDescription = buildVoiceDescription(step1, step2);

  return {
    voiceDescription,
    formality: step2.formality,
    humor: step2.humor,
    jargonLevel: step2.jargonLevel,
    sentenceComplexity: step2.sentenceComplexity,
    toneAttributes,
    preferredVocabulary: existing.preferredVocabulary ?? [],
    avoidedVocabulary: existing.avoidedVocabulary ?? [],
    writingExamples: existing.writingExamples ?? [],
    sourceQuality: existing.sourceQuality ?? "none",
    thoughtLeadershipPositions: step2.thoughtLeadershipPositions.filter(Boolean),
    brandPhilosophy: step2.brandPhilosophy.trim() || undefined,
  };
}

function buildVoiceDescription(
  step1: WizardStep1Answers,
  step2: WizardStep2Answers
): string {
  const formalityLabel =
    step2.formality <= 3 ? "casual" : step2.formality <= 7 ? "balanced" : "formal";
  const humorLabel =
    step2.humor <= 3 ? "dry" : step2.humor <= 7 ? "occasionally witty" : "playful";
  const jargonLabel =
    step2.jargonLevel <= 3
      ? "plain language"
      : step2.jargonLevel <= 7
        ? "moderate technical language"
        : "technical jargon";

  const personality = step1.brandPersonalityWords.slice(0, 3).join(", ");
  const brands = step1.brandsAdmired.slice(0, 2).join(" and ");

  let desc = `A ${formalityLabel}, ${humorLabel} voice with ${jargonLabel}.`;
  if (personality) desc += ` Brand personality: ${personality}.`;
  if (brands) desc += ` Writing style inspired by ${brands}.`;
  if (step1.dinnerPartyDescription) {
    desc += ` ${step1.dinnerPartyDescription.trim()}`;
  }

  return desc;
}
