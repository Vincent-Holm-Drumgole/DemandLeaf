import { sanitizePromptInput } from "./sanitize";

export const EDIT_PATTERN_VERSION = "v1.0";

interface EditRecord {
  editType: string;
  originalText: string;
  editedText: string;
}

/**
 * Haiku prompt for analyzing accumulated edit patterns and suggesting
 * voice profile adjustments.
 *
 * Returns JSON with patterns and suggested adjustments.
 */
export function buildEditPatternAnalysisPrompt(
  edits: EditRecord[]
): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `You are a writing pattern analysis assistant. Given a set of paragraph edits categorized by type, identify recurring patterns and suggest voice profile adjustments.

Analyze the edit history and return JSON:
{
  "patterns": [
    {
      "editType": "<type>",
      "frequency": <number>,
      "examples": ["<brief description of example 1>", "<brief description of example 2>"],
      "suggestedAdjustment": "<one sentence recommendation for voice profile>"
    }
  ],
  "summary": "<one paragraph summary of what these edits reveal about the user's preferences>"
}

Focus only on patterns with 3+ occurrences. Be specific and actionable.`;

  // Group edits by type for a cleaner prompt
  const byType: Record<string, EditRecord[]> = {};
  for (const edit of edits) {
    if (!byType[edit.editType]) byType[edit.editType] = [];
    byType[edit.editType].push(edit);
  }

  const editSummary = Object.entries(byType)
    .map(([type, records]) => {
      const examples = records.slice(0, 3).map((r) => {
        const origNorm = r.originalText.replace(/\r\n|\r|\n/g, " ");
        const editedNorm = r.editedText.replace(/\r\n|\r|\n/g, " ");
        const origTrunc = origNorm.slice(0, 100);
        const editedTrunc = editedNorm.slice(0, 100);
        const origSuffix = origNorm.length > 100 ? "..." : "";
        const editedSuffix = editedNorm.length > 100 ? "..." : "";
        const orig = sanitizePromptInput(origTrunc);
        const edited = sanitizePromptInput(editedTrunc);
        return `  - Original: "${orig}${origSuffix}" → Edited: "${edited}${editedSuffix}"`;
      });
      return `${type.toUpperCase()} (${records.length} edits):\n${examples.join("\n")}`;
    })
    .join("\n\n");

  const userMessage = `EDIT HISTORY (${edits.length} edits total):

${editSummary}

Analyze these patterns and return JSON only.`;

  return { systemPrompt, userMessage };
}

