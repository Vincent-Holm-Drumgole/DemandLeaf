import { sanitizePromptInput, sanitizeSingleLine, sanitizeXmlContent } from "@/lib/ai/prompts/sanitize";
import type { ScorecardDimension } from "./tags";
import { SCORECARD_DIMENSION_LABELS } from "./tags";

export interface TrainingSignalExample<TBlogId = string> {
  blogId: TBlogId;
  title: string;
  compositeScore: number;
  excerpt: string;
}

export interface TrainingSignalTag {
  dimension: ScorecardDimension;
  tag: string;
  count: number;
}

export interface TrainingSignalsPayload<TBlogId = string> {
  fewShotExamples: TrainingSignalExample<TBlogId>[];
  suppressedTags: TrainingSignalTag[];
  coachingNotes: string[];
}

export function formatTrainingSignals<TBlogId>(
  payload: TrainingSignalsPayload<TBlogId>,
): string | undefined {
  const sections: string[] = [];

  if (payload.fewShotExamples.length > 0) {
    const examples = payload.fewShotExamples
      .map(
        (example) => `<example>
<blog_id>${sanitizeXmlContent(String(example.blogId))}</blog_id>
<title>${sanitizeXmlContent(example.title)}</title>
<composite_score>${example.compositeScore.toFixed(1)}</composite_score>
<excerpt>
${sanitizeXmlContent(example.excerpt)}
</excerpt>
</example>`,
      )
      .join("\n\n");

    sections.push(`<training_examples>
${examples}
</training_examples>`);
  }

  if (payload.suppressedTags.length > 0) {
    sections.push(`SUPPRESSED PATTERNS:
${payload.suppressedTags
  .map(
    (tag) =>
      `- ${SCORECARD_DIMENSION_LABELS[tag.dimension]}: ${sanitizeSingleLine(tag.tag)} (seen ${tag.count} times)`,
  )
  .join("\n")}`);
  }

  if (payload.coachingNotes.length > 0) {
    sections.push(`WORKSPACE COACHING NOTES:
${payload.coachingNotes.map((note) => `- ${sanitizePromptInput(note)}`).join("\n")}`);
  }

  const result = sections.join("\n\n").trim();
  return result.length > 0 ? result : undefined;
}
