import type { AIModel } from "@/types";

export const MODEL_IDS: Record<AIModel, string> = {
  // Official stable aliases from Anthropic docs (Feb 2026).
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
} as const;

// Pricing in cents per 1M tokens
export const MODEL_PRICING: Record<
  AIModel,
  { inputPer1M: number; outputPer1M: number }
> = {
  sonnet: { inputPer1M: 300, outputPer1M: 1500 },
  haiku: { inputPer1M: 100, outputPer1M: 500 },
} as const;

export function getModelId(model: AIModel): string {
  return MODEL_IDS[model];
}

export function calculateCost(
  model: AIModel,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  const safeInputTokens = Number.isFinite(inputTokens) ? Math.max(0, inputTokens) : 0;
  const safeOutputTokens = Number.isFinite(outputTokens) ? Math.max(0, outputTokens) : 0;
  const inputCostCents = (safeInputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCostCents = (safeOutputTokens / 1_000_000) * pricing.outputPer1M;
  return Math.round(inputCostCents + outputCostCents);
}
