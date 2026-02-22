import type { DetectionFlag } from "@/types";
import { extractHeadings } from "@/lib/text-utils";
import { SEVERITY_LOW_HEADING_VARIATION } from "@/lib/constants/detection";

type HeadingStyle = "question" | "how_to" | "imperative" | "statement" | "numbered";

/**
 * Analyze heading style diversity.
 * Flags when all headings follow the same pattern (e.g., all questions, all "How to..." ).
 */
export function checkHeadingVariation(content: string): DetectionFlag[] {
  const headings = extractHeadings(content).filter((h) => h.level >= 2);
  const flags: DetectionFlag[] = [];

  if (headings.length < 3) return flags;

  const styles = headings.map((h) => classifyHeadingStyle(h.text));

  // Check if all headings are the same style
  const uniqueStyles = new Set(styles);
  if (uniqueStyles.size === 1) {
    flags.push({
      algorithm: "heading_variation",
      severity: SEVERITY_LOW_HEADING_VARIATION,
      detail: `All ${headings.length} headings use the same style (${styles[0]}). Mix questions, statements, and imperatives.`,
    });
  }

  return flags;
}

function classifyHeadingStyle(heading: string): HeadingStyle {
  const lower = heading.toLowerCase().trim();

  if (lower.endsWith("?")) return "question";
  if (/^\d+[\.\)]\s/.test(lower)) return "numbered";
  if (/^how\s+to\s/i.test(lower)) return "how_to";
  if (/^(get|use|try|start|stop|avoid|create|build|make|find|choose)\s/i.test(lower)) {
    return "imperative";
  }
  return "statement";
}
