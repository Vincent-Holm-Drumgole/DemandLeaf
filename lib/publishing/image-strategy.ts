import type { ImagePlacement } from "@/types";

const WORDS_PER_IMAGE = 350;

/**
 * Suggest image placements at ~350-word intervals.
 * Alt text is null — filled by Haiku in a separate step.
 */
export function suggestImagePlacements(content: string): ImagePlacement[] {
  const lines = content.split("\n");
  const placements: ImagePlacement[] = [];
  let wordCount = 0;
  let nextThreshold = WORDS_PER_IMAGE;
  let lastHeading = "";

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      lastHeading = headingMatch[1];
    }
    wordCount += (line.match(/\S+/g) ?? []).length;
    if (wordCount >= nextThreshold) {
      placements.push({
        afterWordCount: wordCount,
        suggestedAlt: null,
        heading: lastHeading || undefined,
      });
      nextThreshold += WORDS_PER_IMAGE;
    }
  }

  return placements;
}
