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
        const origRaw = sanitizePromptInput(r.originalText).replace(/\n/g, " ");
        const editedRaw = sanitizePromptInput(r.editedText).replace(/\n/g, " ");
        const orig = origRaw.slice(0, 100);
        const edited = editedRaw.slice(0, 100);
        const origSuffix = origRaw.length > 100 ? "..." : "";
        const editedSuffix = editedRaw.length > 100 ? "..." : "";
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

function sanitizePromptInput(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```/g, "\\`\\`\\`");
}
