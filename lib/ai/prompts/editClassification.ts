export const EDIT_CLASSIFICATION_VERSION = "v1.0";

/**
 * Haiku prompt for classifying a single paragraph edit.
 *
 * Returns JSON: { editType: string, reasoning: string }
 * editType: "tone" | "factual" | "restructure" | "style" | "addition" | "deletion"
 */
export function buildEditClassificationPrompt(
  originalText: string,
  editedText: string
): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `You are an edit classification assistant. Given the original and edited version of a paragraph, classify what type of edit was made.

Edit types:
- "tone": Changes to formality, humor, or emotional register (e.g., more casual, more serious)
- "factual": Added or corrected specific facts, numbers, or data
- "restructure": Reordered sentences or changed paragraph structure significantly
- "style": Changed word choices, sentence patterns, or stylistic elements without changing substance
- "addition": Added new content, sentences, or ideas
- "deletion": Removed content, simplified, or trimmed

Return valid JSON only:
{ "editType": "<type>", "reasoning": "<one sentence explanation>" }`;

  const userMessage = `ORIGINAL:
${sanitizePromptInput(originalText).slice(0, 500)}

EDITED:
${sanitizePromptInput(editedText).slice(0, 500)}

Classify this edit. Return JSON only.`;

  return { systemPrompt, userMessage };
}

function sanitizePromptInput(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```/g, "\\`\\`\\`");
}
