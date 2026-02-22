import type { AICallResult, AICallBreakdown } from "@/types";

export interface TokenSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  totalDurationMs: number;
  callCount: number;
  calls: AICallBreakdown[];
}

interface TrackedAICall extends AICallResult {
  step: string;
}

export class TokenTracker {
  private calls: TrackedAICall[] = [];

  record(step: string, result: AICallResult): void {
    this.calls.push({ ...result, step });
  }

  get totalInputTokens(): number {
    return this.calls.reduce((sum, c) => sum + c.inputTokens, 0);
  }

  get totalOutputTokens(): number {
    return this.calls.reduce((sum, c) => sum + c.outputTokens, 0);
  }

  get totalCostCents(): number {
    return this.calls.reduce((sum, c) => sum + c.costCents, 0);
  }

  get totalDurationMs(): number {
    return this.calls.reduce((sum, c) => sum + c.durationMs, 0);
  }

  get summary(): TokenSummary {
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCostCents: this.totalCostCents,
      totalDurationMs: this.totalDurationMs,
      callCount: this.calls.length,
      calls: this.calls.map((call) => ({
        step: call.step,
        model: call.model,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        costCents: call.costCents,
        durationMs: call.durationMs,
      })),
    };
  }
}
