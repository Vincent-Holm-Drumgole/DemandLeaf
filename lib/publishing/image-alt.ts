import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import type { ImagePlacement } from "@/types";

/**
 * Generate alt text for image placements using Haiku.
 * Single batch call for all placements (1 Haiku call per blog).
 */
export async function generateAltTexts(
  title: string,
  focusKeyword: string,
  placements: ImagePlacement[]
): Promise<string[]> {
  if (placements.length === 0) return [];

  const system = `You generate concise, descriptive image alt text (8-15 words each).
Each alt text should describe what an illustrative image at that section would show.
Include the focus keyword naturally in at least one alt text.
Return a JSON array of strings, one per placement. Nothing else.`;

  const user = `Blog title: "${title}"
Focus keyword: "${focusKeyword}"
Sections needing alt text:
${placements.map((p, i) => `${i + 1}. Section: "${p.heading ?? "Introduction"}"`).join("\n")}

Return a JSON array with exactly ${placements.length} alt text strings.`;

  const result = await callHaiku(system, user, {
    maxTokens: 512,
    temperature: 0.5,
  });

  try {
    const parsed = parseJsonResponse<string[]>(result.content);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, placements.length);
    }
    return fallbackAlts(title, focusKeyword, placements.length);
  } catch {
    return fallbackAlts(title, focusKeyword, placements.length);
  }
}

function fallbackAlts(
  title: string,
  focusKeyword: string,
  count: number
): string[] {
  return Array.from(
    { length: count },
    (_, i) =>
      i === 0
        ? `${focusKeyword} illustration for ${title}`
        : `${title} section ${i + 1} illustration`
  );
}
