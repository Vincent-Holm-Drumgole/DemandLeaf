import type { DetectionFlag } from "@/types";
import { extractParagraphs, countWords } from "@/lib/text-utils";

const NAMED_ENTITY_PATTERN = /\b(?:Salesforce|HubSpot|Pardot|Marketo|Eloqua|Google Ads|LinkedIn|Meta|Aldwin)\b/;
const CONCRETE_ACTION_PATTERN = /\b(?:configure|sync|segment|score|route|audit|benchmark|attribute|integrate)\b/i;
const SEVERITY_FILLER_PARAGRAPH = 7;

export interface FillerParagraphAnalysis {
  flags: DetectionFlag[];
  fillerRatio: number;
}

export function analyzeFillerParagraphs(content: string): FillerParagraphAnalysis {
  const paragraphs = extractParagraphs(content);
  if (paragraphs.length === 0) {
    return { flags: [], fillerRatio: 0 };
  }

  const fillerIndexes = paragraphs
    .map((paragraph, index) => ({ paragraph, index }))
    .filter(({ paragraph }) => {
      const hasNumber = /\d/.test(paragraph);
      const hasNamedEntity = NAMED_ENTITY_PATTERN.test(paragraph);
      const hasConcreteAction = CONCRETE_ACTION_PATTERN.test(paragraph);
      return !hasNumber && !hasNamedEntity && !hasConcreteAction && countWords(paragraph) >= 20;
    });

  return {
    flags: fillerIndexes.map(({ index }) => ({
      algorithm: "filler_paragraph",
      severity: SEVERITY_FILLER_PARAGRAPH,
      location: `paragraph ${index}`,
      detail: "Paragraph reads as filler because it lacks concrete examples, named tools, or data",
    })),
    fillerRatio: fillerIndexes.length / paragraphs.length,
  };
}
