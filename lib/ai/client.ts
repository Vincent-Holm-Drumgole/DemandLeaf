import Anthropic from "@anthropic-ai/sdk";
import type { AICallOptions, AICallResult } from "@/types";
import { getModelId, calculateCost } from "./models";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const RETRYABLE_STATUSES = new Set([429, 529]);

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _client;
}

/**
 * Call the Anthropic Claude API with automatic retries and cost tracking.
 *
 * Retries on: 429 (rate limit), 529 (overloaded), 5xx (server errors).
 * Does NOT retry on: 400 (bad request), 401 (auth), 403 (forbidden).
 */
export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const client = getClient();
  const modelId = getModelId(options.model);
  const startTime = Date.now();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: modelId,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 1,
        system: options.systemPrompt,
        messages: [{ role: "user", content: options.userMessage }],
      });

      const durationMs = Date.now() - startTime;
      const content = extractTextContent(response);
      const costCents = calculateCost(
        options.model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      return {
        content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: modelId,
        costCents,
        durationMs,
      };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on explicit retryable status codes.
      if (!isRetryable(error)) {
        throw lastError;
      }

      // Wait with exponential backoff before retrying
      if (attempt < MAX_RETRIES - 1) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoffMs);
      }
    }
  }

  throw lastError ?? new Error("AI call failed after all retries");
}

/**
 * Convenience wrapper for Sonnet calls.
 */
export async function callSonnet(
  systemPrompt: string,
  userMessage: string,
  options?: Partial<AICallOptions>
): Promise<AICallResult> {
  return callAI({
    model: "sonnet",
    systemPrompt,
    userMessage,
    ...options,
  });
}

/**
 * Convenience wrapper for Haiku calls.
 */
export async function callHaiku(
  systemPrompt: string,
  userMessage: string,
  options?: Partial<AICallOptions>
): Promise<AICallResult> {
  return callAI({
    model: "haiku",
    systemPrompt,
    userMessage,
    ...options,
  });
}

/**
 * Parse a JSON response from an LLM call.
 * Strips markdown code fences if present.
 */
export function parseJsonResponse<T>(content: string): T {
  const cleaned = stripMarkdownFences(content.trim());
  const candidates = [cleaned];

  const extracted = extractFirstJsonValue(cleaned);
  if (extracted && extracted !== cleaned) {
    candidates.push(extracted);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try next candidate.
    }
  }

  const preview = cleaned.slice(0, 280).replace(/\s+/g, " ");
  throw new Error(`Invalid JSON response from model: ${preview}`);
}

// ─── Internal helpers ────────────────────────────────────────────────

function extractTextContent(
  response: Anthropic.Messages.Message
): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function isRetryable(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status: unknown }).status);
    if (Number.isNaN(status)) return false;
    return RETRYABLE_STATUSES.has(status) || (status >= 500 && status <= 599);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripMarkdownFences(input: string): string {
  const fenced = input.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  return fenced ? fenced[1].trim() : input;
}

function extractFirstJsonValue(input: string): string | null {
  const startIndex = input.search(/[\[{]/);
  if (startIndex < 0) return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = startIndex; i < input.length; i++) {
    const char = input[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === "\\") {
        isEscaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth++;
      continue;
    }

    if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) {
        return input.slice(startIndex, i + 1).trim();
      }
    }
  }

  return null;
}
