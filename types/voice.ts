export type SourceQuality = "strong" | "mixed" | "limited" | "none";

export type EditType =
  | "tone"
  | "factual"
  | "restructure"
  | "style"
  | "addition"
  | "deletion";

export interface EditPattern {
  editType: EditType;
  frequency: number;
  examples: string[];
  suggestedAdjustment: string;
}

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
  // Phase 2 additions
  thoughtLeadershipPositions?: string[];
  brandPhilosophy?: string;
  editPatterns?: EditPattern[];
}
