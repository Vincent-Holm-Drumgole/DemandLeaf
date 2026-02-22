export interface AICallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  costCents: number;
  durationMs: number;
}

export type AIModel = "sonnet" | "haiku";

export interface AICallOptions {
  model: AIModel;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}
