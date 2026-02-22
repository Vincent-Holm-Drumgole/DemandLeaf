export type SourceQuality = "strong" | "mixed" | "limited" | "none";

export interface VoiceProfile {
  voiceDescription: string;
  formality: number; // 1-10
  humor: number; // 1-10
  jargonLevel: number; // 1-10
  sentenceComplexity: number; // 1-10
  toneAttributes: string[];
  preferredVocabulary: string[];
  avoidedVocabulary: string[];
  writingExamples: string[];
  sourceQuality: SourceQuality;
}
